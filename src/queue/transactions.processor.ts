import {
    Processor,
    WorkerHost,
} from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { env } from 'configs/env.config'
import { TxStatus } from '@prisma/client'
import { ApiService } from 'libs/api.service'
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

                console.log({ txnInfo })

                let status = 'Pending'
                switch (txnInfo.tx_status) {
                    case 'success':
                        status = 'Success'
                        break
                    case 'pending':
                        status = 'Pending'
                        break
                    case 'abort_by_response':
                        status = 'Failed'
                        break
                    default:
                        break
                }

                const update = await this.prisma.transaction.update({
                    where: { id: data.transaction.id },
                    data: { txStatus: status as TxStatus },
                })
                console.log({ update })
            default:
                break
        }
    }
}