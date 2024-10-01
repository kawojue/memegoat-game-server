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
    data: { id, userId, start, end, stake },
  }: Job<{
    id: string;
    end: Date;
    start: Date;
    stake: number;
    userId: string;
  }>) {
    switch (name) {
      case 'sport':
        const sportRounds = await this.prisma.sportRound.findFirst({
          where: {
            userId,
            updatedAt: {
              gte: start,
              lte: end,
            },
          },
        });

        if (!sportRounds) {
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
        const gameRounds = await this.prisma.round.findFirst({
          where: {
            userId,
            gameTournamentId: id,
          },
        });

        if (!gameRounds) {
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
