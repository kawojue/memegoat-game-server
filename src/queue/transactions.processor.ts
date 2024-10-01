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
              tag: {
                in: [
                  'BUY-TICKETS',
                  'CLAIM-REWARDS',
                  'BURN-GOAT',
                  'STORE-TOURNAMENT-RECORD',
                ],
              },
            },
          });

          if (tx) {
            if (
              txnInfo.contract_call.contract_id === env.hiro.contractId ||
              txnInfo.contract_call.contract_id === env.hiro.goatTokenId
            ) {
              console.log(txnInfo);
              await this.prisma.$transaction(async (prisma) => {
                let amount = 0;
                let txMeta: any;

                if (txnInfo.contract_call.function_name === 'buy-tickets') {
                  const tickets = new BigNumber(
                    cvToValue(
                      Cl.deserialize(
                        hexToBytes(txnInfo.contract_call.function_args[0].hex),
                      ),
                    ),
                  ).toNumber();

                  amount = tickets * env.hiro.ticketPrice;

                  // Update user's ticket count in stats
                  await prisma.stat.update({
                    where: { userId: tx.userId },
                    data: { tickets: { increment: tickets } },
                  });

                  // Check for the latest ticket record and update or create a new one
                  const ticketRecord = await prisma.ticketRecords.findFirst({
                    where: { rolloverRatio: 0 },
                    orderBy: { createdAt: 'desc' },
                  });
                  console.log(ticketRecord);
                  if (ticketRecord) {
                    await prisma.ticketRecords.update({
                      where: { id: ticketRecord.id },
                      data: { boughtTickets: { increment: tickets } },
                    });
                  } else {
                    await prisma.ticketRecords.create({
                      data: { boughtTickets: tickets },
                    });
                  }
                }

                if (txnInfo.contract_call.function_name === 'claim-rewards') {
                  // Update reward claim status
                  await prisma.reward.update({
                    where: { id: tx.key, userId: tx.userId },
                    data: { claimed: 'SUCCESSFUL' },
                  });

                  txMeta = { action: 'REWARDS-CLAIMED' };
                }

                if (txnInfo.contract_call.function_name === 'burn') {
                  // Update user tickets count after burn
                  await prisma.stat.update({
                    where: { userId: tx.userId },
                    data: { tickets: { increment: 2 } },
                  });

                  txMeta = { action: 'GOAT-BURN' };

                  // Handle ticket record update or creation
                  const ticketRecord = await prisma.ticketRecords.findFirst({
                    where: { rolloverRatio: 0 },
                    orderBy: { createdAt: 'desc' },
                  });
                  console.log(ticketRecord);
                  if (ticketRecord) {
                    await prisma.ticketRecords.update({
                      where: { id: ticketRecord.id },
                      data: { freeTickets: { increment: 2 } },
                    });
                  } else {
                    await prisma.ticketRecords.create({
                      data: { freeTickets: 2 },
                    });
                  }
                }

                if (
                  txnInfo.contract_call.function_name ===
                  'store-tournament-record'
                ) {
                  // Mark rewards claimable for the given tournament
                  await prisma.reward.updateMany({
                    where: {
                      OR: [
                        { gameTournamentId: tx.tourId },
                        { sportTournamentId: tx.tourId },
                      ],
                    },
                    data: { claimable: true },
                  });
                }

                // Update the transaction status
                await prisma.transaction.update({
                  where: { id: tx.id },
                  data: {
                    amount,
                    txStatus: 'Success',
                    ...txMeta,
                  },
                });

                // Update all pending rewards for the user to 'SUCCESSFUL'
                await prisma.reward.updateMany({
                  where: {
                    userId: tx.userId,
                    claimed: 'PENDING',
                  },
                  data: {
                    claimed: 'SUCCESSFUL',
                  },
                });
              });

              break; // Ensure this loop or block ends after successful transaction handling
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
