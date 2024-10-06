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
      stake,
      userId,
    }: {
      id: string;
      stake: number;
      userId: string;
    },
  ) {
    const user = await this.user.findUnique({
      where: { id: userId },
    });

    switch (name) {
      case 'sport':
        await this.retryTransaction(async () => {
          if (user) {
            const sportBetsCount = await this.sportBet.count({
              where: {
                userId: user.id,
                sportTournamentId: id,
              },
            });

            await this.sportTournament.update({
              where: { id },
              data:
                sportBetsCount === 0
                  ? {
                      uniqueUsers: { increment: 1 },
                      totalStakes: { increment: stake },
                    }
                  : {
                      totalStakes: { increment: stake },
                    },
            });
          }
        }, 2);
        break;

      case 'game':
        await this.retryTransaction(async () => {
          if (user) {
            const gameRoundsCount = await this.round.count({
              where: {
                userId: user.id,
                gameTournamentId: id,
              },
            });

            await this.tournament.update({
              where: { id },
              data:
                gameRoundsCount === 0
                  ? {
                      uniqueUsers: { increment: 1 },
                      totalStakes: { increment: stake },
                    }
                  : {
                      totalStakes: { increment: stake },
                    },
            });
          }
        }, 2);
        break;

      default:
        throw new Error(`Unknown tournament type: ${name}`);
    }
  }
}
