import { Job } from 'bullmq';
import { ApiService } from 'libs/api.service';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { PrismaService } from 'prisma/prisma.service';
import { BetStatus, SportbetOutcome } from '@prisma/client';

@Processor('sports-football-queue')
export class FootballSportsQueueProcessor extends WorkerHost {
  constructor(
    private readonly api: ApiService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process({ data: { batchIds } }: Job<{ batchIds: string }>) {
    const res = await this.api.apiSportGET<any>(`/fixtures?ids=${batchIds}`);
    const fixtures = res.response as FootballMatchResponse[];

    const currentSportTournament = await this.prisma.currentSportTournament();

    await Promise.all(
      fixtures.map(async (game) => {
        const bets = await this.prisma.sportBet.findMany({
          where: { fixureId: String(game.fixture.id) },
        });

        for (const bet of bets) {
          let outcome: SportbetOutcome = SportbetOutcome.NOT_DECIDED;

          const elapsed = game.fixture.status?.elapsed;
          let status: BetStatus =
            elapsed !== null ? BetStatus.ONGOING : BetStatus.NOT_STARTED;

          if (
            game.fixture.status.short === 'FT' ||
            game.fixture.status.short === 'AET' ||
            game.fixture.status.short === 'PEN'
          ) {
            const homeWin = game.teams.home.winner;
            const awayWin = game.teams.away.winner;

            if (bet.placebetOutcome === 'home' && homeWin) {
              outcome = SportbetOutcome.WIN;
            } else if (bet.placebetOutcome === 'away' && awayWin) {
              outcome = SportbetOutcome.WIN;
            } else if (bet.placebetOutcome === 'draw' && homeWin === awayWin) {
              outcome = SportbetOutcome.WIN;
            } else {
              outcome = SportbetOutcome.LOSE;
            }

            status = BetStatus.FINISHED;
          } else if (
            game.fixture.status.short === 'CANC' ||
            game.fixture.status.short === 'SUSP'
          ) {
            status = BetStatus.FINISHED;
            outcome = SportbetOutcome.CANCELLED;
          }

          await this.prisma.retryTransaction(async () => {
            if (outcome === SportbetOutcome.WIN) {
              await this.prisma.sportRound.update({
                where: { betId: bet.id },
                data: { point: bet.potentialWin },
              });

              await this.prisma.stat.update({
                where: { userId: bet.userId },
                data: {
                  total_sport_wins: { increment: 1 },
                  xp: { increment: Math.sqrt(bet.potentialWin) },
                  total_sport_points: { increment: bet.potentialWin },
                },
              });
            }

            if (outcome === SportbetOutcome.LOSE) {
              await this.prisma.stat.update({
                where: { userId: bet.userId },
                data: {
                  total_sport_losses: { increment: 1 },
                },
              });
            }

            if (outcome === SportbetOutcome.CANCELLED) {
              await this.prisma.stat.update({
                where: { userId: bet.userId },
                data: {
                  tickets: { increment: bet.stake },
                },
              });
            }

            await this.prisma.sportBet.update({
              where: { id: bet.id },
              data: {
                outcome,
                status,
                goals: {
                  home: game.goals.home,
                  away: game.goals.away,
                },
                elapsed: elapsed === null ? null : String(elapsed),
              },
            });
          }, 5);
        }
      }),
    );
  }
}
