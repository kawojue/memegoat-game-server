import { Job } from 'bullmq';
import { BigNumber } from 'bignumber.js';
import { env } from 'configs/env.config';
import { TxStatus } from '@prisma/client';
import { hexToBytes } from '@stacks/common';
import { ApiService } from 'libs/api.service';
import { Cl, cvToValue } from '@stacks/transactions';
import { PrismaService } from 'prisma/prisma.service';
import { Processor, WorkerHost } from '@nestjs/bullmq';

@Processor('transactions-queue')
export class TransactionsQueueProcessor extends WorkerHost {
  constructor(
    private readonly api: ApiService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process({ data, name }: Job<any>) {
    switch (name) {
      case 'wh.transaction':
        await this.prisma.transaction.upsert({
          where: { txId: data.payload.txId },
          create: data.payload,
          update: data.payload,
        });
        break;
      case 'cron.transaction':
        const txnInfo = await this.api.fetchTransaction<any>(
          env.hiro.channel,
          data.transaction.txId,
        );

        let status = 'Pending' as TxStatus;
        switch (txnInfo.tx_status) {
          case 'success':
            status = 'Success';
            break;
          case 'pending':
            status = 'Pending';
            break;
          case 'abort_by_response':
          case 'abort_by_post_condition':
            status = 'Failed';
            break;
          case 'dropped_replace_by_fee':
          case 'dropped_stale_garbage_collect':
            status = 'Dropped';
            break;
          default:
            break;
        }

        if (status === 'Success') {
          const tx = await this.prisma.transaction.findUnique({
            where: {
              txId: data.transaction.txId,
              txStatus: 'Pending',
              tag: { in: ['BUY-TICKETS', 'CLAIM-REWARDS', 'BURN-GOAT'] },
            },
          });

          if (tx) {
            if (
              txnInfo.contract_call.contract_id === env.hiro.contractId ||
              txnInfo.contract_call.contract_id === env.hiro.goatTokenId
            ) {
              let amount = 0;

              if (txnInfo.contract_call.function_name === 'buy-tickets') {
                const tickets = new BigNumber(
                  cvToValue(
                    Cl.deserialize(
                      hexToBytes(txnInfo.contract_call.function_args[0].hex),
                    ),
                  ),
                ).toNumber();

                amount = tickets * env.hiro.ticketPrice;

                await this.prisma.stat.update({
                  where: { userId: tx.userId },
                  data: { tickets: { increment: tickets } },
                });

                const ticketRecord = await this.prisma.ticketRecords.findFirst({
                  where: { rolloverRatio: 0 },
                  orderBy: {
                    createdAt: 'desc',
                  },
                });

                if (ticketRecord) {
                  await this.prisma.ticketRecords.update({
                    where: { id: ticketRecord.id },
                    data: { boughtTickets: { increment: tickets } },
                  });
                } else {
                  await this.prisma.ticketRecords.create({
                    data: { boughtTickets: tickets },
                  });
                }
              }

              let txMeta: any;

              if (txnInfo.contract_call.function_name === 'claim-rewards') {
                await this.prisma.reward.update({
                  where: { id: tx.key, userId: tx.userId },
                  data: { claimed: 'SUCCESSFUL' },
                });

                txMeta = {
                  action: 'REWARDS-CLAIMED',
                };
              }

              if (txnInfo.contract_call.function_name === 'burn') {
                await this.prisma.stat.update({
                  where: { userId: tx.userId },
                  data: { tickets: { increment: 2 } },
                });

                txMeta = {
                  action: 'GOAT-BURN',
                };

                const ticketRecord = await this.prisma.ticketRecords.findFirst({
                  where: { rolloverRatio: 0 },
                  orderBy: {
                    createdAt: 'desc',
                  },
                });

                if (ticketRecord) {
                  await this.prisma.ticketRecords.update({
                    where: { id: ticketRecord.id },
                    data: { freeTickets: { increment: 2 } },
                  });
                } else {
                  await this.prisma.ticketRecords.create({
                    data: { freeTickets: 2 },
                  });
                }
              }

              if (
                txnInfo.contract_call.function_name ===
                'store-tournament-record'
              ) {
                await this.prisma.reward.updateMany({
                  where: {
                    OR: [
                      { gameTournamentId: tx.tourId },
                      { sportTournamentId: tx.tourId },
                    ],
                  },
                  data: { claimable: true },
                });
              }

              await this.prisma.transaction.update({
                where: { id: tx.id },
                data: {
                  amount,
                  txStatus: 'Success',
                  ...txMeta,
                },
              });

              await this.prisma.reward.updateMany({
                where: {
                  userId: tx.userId,
                  claimed: 'PENDING',
                },
                data: {
                  claimed: 'SUCCESSFUL',
                },
              });

              break;
            }
          }
        }

        await this.prisma.transaction.update({
          where: { id: data.transaction.id },
          data: { txStatus: status as TxStatus },
        });
        break;
      default:
        break;
    }
  }
}
