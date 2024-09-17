import {
    Processor,
    WorkerHost,
} from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { PrismaService } from 'prisma/prisma.service'
import { broadcastTransaction } from '@stacks/transactions'

@Processor('reward-tx-queue')
export class RewardTxQueueProcessor extends WorkerHost {
    constructor(
        private readonly prisma: PrismaService,
    ) {
        super()
    }

    async process({ data }: Job<any>) {
        const broadcastResponse = await broadcastTransaction(
            data.transaction,
            data.network,
        );

        if (!broadcastResponse?.error) {
            await this.prisma.reward.updateMany({
                where: {
                    userId: data.sub,
                    claimed: 'PENDING',
                },
                data: { claimed: 'SUCCESSFUL' },
            });
        } else {
            await this.prisma.reward.updateMany({
                where: {
                    userId: data.sub,
                    claimed: 'PENDING',
                },
                data: { claimed: 'DEFAULT' },
            });
        }
    }
}