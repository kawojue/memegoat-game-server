import {
    Process,
    Processor,
    OnQueueActive,
    OnQueueFailed,
    OnQueueCompleted,
} from '@nestjs/bull'
import { Job } from 'bull'
import { env } from 'configs/env.config'
import { TxStatus } from '@prisma/client'
import { ApiService } from 'libs/api.service'
import { PrismaService } from 'prisma/prisma.service'
import { WhTxPayload } from 'src/webhook/webhook.service'

@Processor('transactions-queue')
export class TransactionsQueueProcessor {
    constructor(
        private readonly api: ApiService,
        private readonly prisma: PrismaService,
    ) { }

    @Process('wh.transaction')
    async handleCreateTransactionQueueJob({ data }: Job<{ payload: WhTxPayload }>) {
        await this.prisma.transaction.upsert({
            where: { txId: data.payload.txId },
            create: data.payload,
            update: data.payload,
        })
    }

    @Process('cron.transaction')
    async handleCronTransactionUpdate({ data }: Job<{
        transaction: {
            id: string
            txId: string
        }
    }>) {
        const txnInfo = await this.api.fetchTransaction<any>(
            env.hiro.channel,
            data.transaction.txId,
        )

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

        await this.prisma.transaction.update({
            where: { id: data.transaction.id },
            data: { txStatus: status as TxStatus },
        })
    }

    @OnQueueActive()
    onActive(job: Job) {
        console.info(
            `(Queue) Processing: job ${job.id} of ${job.queue.name} with data: ${JSON.stringify(job.data)}...`
        )
    }

    @OnQueueCompleted()
    async OnQueueCompleted(job: Job) {
        console.info(
            '(Queue) Completed: job ',
            job.id,
            job.queue.name,
        )
    }

    @OnQueueFailed()
    OnQueueFailed(job: Job, error: Error) {
        console.info(
            '(Queue) Error on: job ',
            job.id,
            ' -> error: ',
            error.message,
        )
    }
}