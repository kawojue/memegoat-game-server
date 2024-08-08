import { subDays } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { TxStatus } from '@prisma/client';
import { ApiService } from './api.service';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiService: ApiService,
  ) {}

  @Cron(CronExpression.EVERY_WEEK)
  async refreshTournament() {
    const key = uuidv4();
    const start = new Date();
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    await this.prisma.tournament.upsert({
      where: { key },
      create: { key, start, end },
      update: { start, end },
    });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async updateTransactions() {
    const batchSize = 100;
    let usersProcessed = 0;
    const thirtyDaysAgo = subDays(new Date(), 30);

    while (true) {
      const transactions = await this.prisma.transaction.findMany({
        where: {
          txStatus: 'Pending',
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
        select: { id: true, txId: true },
        take: batchSize,
        skip: usersProcessed,
      });

      if (transactions.length === 0) {
        break;
      }

      for (const transaction of transactions) {
        const txnInfo = await this.apiService.fetchTransaction(
          process.env.HIRO_CHANNEL as HiroChannel,
          transaction.txId,
        );

        let status = 'Pending';
        switch (txnInfo.tx_status) {
          case 'success':
            status = 'Success';
            break;
          case 'pending':
            status = 'Pending';
            break;
          case 'failed':
            status = 'Failed';
            break;
          default:
            break;
        }

        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: { txStatus: status as TxStatus },
        });
      }

      usersProcessed += transactions.length;
    }
  }

  // @Cron(CronExpression.EVERY_MINUTE)
  // async getLiveScores() {
  //     const bets = await this.prisma.bet.findMany({
  //         where: {

  //         }
  //     })
  // }
}
