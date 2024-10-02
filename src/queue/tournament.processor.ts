import { Job } from 'bullmq';
import { PrismaService } from 'prisma/prisma.service';
import { Processor, WorkerHost } from '@nestjs/bullmq';

@Processor('current-tournament-queue')
export class CurrentTournamentProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process({
    name,
    data: { id, userId, stake },
  }: Job<{
    id: string;
    stake: number;
    userId: string;
  }>) {
    switch (name) {
      case 'sport':
        const sportBet = await this.prisma.sportBet.findFirst({
          where: {
            userId,
            sportTournamentId: id,
          },
        });

        if (!sportBet) {
          await this.prisma.sportTournament.update({
            where: { id },
            data: {
              uniqueUsers: { increment: 1 },
              totalStakes: { increment: stake },
            },
          });
        } else {
          await this.prisma.sportTournament.update({
            where: { id },
            data: { totalStakes: { increment: stake } },
          });
        }

        break;
      case 'game':
        const gameRound = await this.prisma.round.findFirst({
          where: {
            userId,
            gameTournamentId: id,
          },
        });

        if (!gameRound) {
          await this.prisma.tournament.update({
            where: { id },
            data: {
              uniqueUsers: { increment: 1 },
              totalStakes: { increment: stake },
            },
          });
        } else {
          await this.prisma.tournament.update({
            where: { id },
            data: { totalStakes: { increment: stake } },
          });
        }

        break;
      default:
        break;
    }
  }
}
