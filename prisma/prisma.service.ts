import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  isPrismaError(error: any): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError;
  }

  async retryTransaction(fn: () => Promise<void>, retries: number = 5) {
    for (let i = 0; i < retries; i++) {
      try {
        await fn();
        break;
      } catch (err) {
        if (i === retries - 1 || !this.isPrismaError(err)) {
          throw err;
        }
        console.error(err);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }

  async currentGameTournament() {
    return await this.tournament.findFirst({
      where: {
        paused: false,
        start: { lte: new Date(new Date().toUTCString()) },
        end: { gte: new Date(new Date().toUTCString()) },
      },
    });
  }

  async currentSportTournament() {
    return await this.sportTournament.findFirst({
      where: {
        paused: false,
        start: { lte: new Date(new Date().toUTCString()) },
        end: { gte: new Date(new Date().toUTCString()) },
      },
    });
  }

  async tournamentArg(
    name: 'sport' | 'game',
    {
      id,
      userId,
      stake,
    }: {
      id: string;
      stake: number;
      userId: string;
    },
  ) {
    switch (name) {
      case 'sport':
        await this.retryTransaction(async () => {
          const sportBet = await this.sportBet.findFirst({
            where: {
              userId,
              sportTournamentId: id,
            },
          });

          if (!sportBet) {
            await this.sportTournament.update({
              where: { id },
              data: {
                uniqueUsers: { increment: 1 },
                totalStakes: { increment: stake },
              },
            });
          } else {
            await this.sportTournament.update({
              where: { id },
              data: { totalStakes: { increment: stake } },
            });
          }
        });

        break;
      case 'game':
        await this.retryTransaction(async () => {
          const gameRound = await this.round.findFirst({
            where: {
              userId,
              gameTournamentId: id,
            },
          });

          if (!gameRound) {
            await this.tournament.update({
              where: { id },
              data: {
                uniqueUsers: { increment: 1 },
                totalStakes: { increment: stake },
              },
            });
          } else {
            await this.tournament.update({
              where: { id },
              data: { totalStakes: { increment: stake } },
            });
          }
        });

        break;
      default:
        break;
    }
  }
}
