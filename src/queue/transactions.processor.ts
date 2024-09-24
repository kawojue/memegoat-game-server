import {
    Processor,
    WorkerHost,
} from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { BigNumber } from 'bignumber.js'
import { env } from 'configs/env.config'
import { TxStatus } from '@prisma/client'
import { hexToBytes } from "@stacks/common"
import { ApiService } from 'libs/api.service'
import { Cl, cvToValue } from '@stacks/transactions'
import { PrismaService } from 'prisma/prisma.service'

@Processor('transactions-queue')
export class TransactionsQueueProcessor extends WorkerHost {
    constructor(
        private readonly api: ApiService,
        private readonly prisma: PrismaService,
    ) {
        super()
    }

    async process({ data, name }: Job<any>) {
        switch (name) {
            case 'wh.transaction':
                await this.prisma.transaction.upsert({
                    where: { txId: data.payload.txId },
                    create: data.payload,
                    update: data.payload,
                })
                break
            case 'cron.transaction':
                const txnInfo = await this.api.fetchTransaction<any>(
                    env.hiro.channel,
                    data.transaction.txId,
                )

                let status = 'Pending' as TxStatus
                switch (txnInfo.tx_status) {
                    case 'success':
                        status = 'Success'
                        break
                    case 'pending':
                        status = 'Pending'
                        break
                    case 'abort_by_response':
                    case 'abort_by_post_condition':
                        status = 'Failed'
                        break
                    case 'dropped_replace_by_fee':
                    case 'dropped_stale_garbage_collect':
                        status = 'Dropped'
                        break
                    default:
                        break
                }

                if (status === "Success") {
                    const tx = await this.prisma.transaction.findUnique({
                        where: {
                            txId: data.transaction.txId,
                            txStatus: 'Pending',
                            tag: 'BUY-TICKETS',
                        }
                    })

                    if (tx) {
                        if (
                            txnInfo.contract_call.contract_id === env.hiro.contractId &&
                            txnInfo.contract_call.function_name === "buy-tickets"
                        ) {
                            const tickets = new BigNumber(cvToValue(Cl.deserialize(hexToBytes(txnInfo.contract_call.function_args[0].hex)))).toNumber()

                            const amount = tickets // Assumptions

                            await this.prisma.stat.update({
                                where: { userId: tx.userId },
                                data: { tickets: { increment: tickets } }
                            })

                            await this.prisma.transaction.update({
                                where: { id: tx.id },
                                data: {
                                    amount,
                                    txStatus: 'Success'
                                }
                            })

                            break
                        }
                    }
                }

                await this.prisma.transaction.update({
                    where: { id: data.transaction.id },
                    data: { txStatus: status as TxStatus },
                })
                break
            default:
                break
        }
    }
}