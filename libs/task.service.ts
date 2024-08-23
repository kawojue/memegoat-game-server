import { Queue } from 'bull'
import { subDays } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import { InjectQueue } from '@nestjs/bull'
import { Injectable } from '@nestjs/common'
import { PrismaService } from 'prisma/prisma.service'
import { Cron, CronExpression } from '@nestjs/schedule'

@Injectable()
export class TaskService {
    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue('transactions-queue') private readonly transactionQueue: Queue,
    ) { }

    @Cron(CronExpression.EVERY_WEEK)
    async refreshTournament() {
        const key = uuidv4()
        const start = new Date()
        const end = new Date(start)
        end.setDate(start.getDate() + 7)

        await this.prisma.tournament.upsert({
            where: { key },
            create: { key, start, end },
            update: { start, end },
        })
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async updateTransactions() {
        const batchSize = 200
        let transactionsProcessed = 0
        const thirtyDaysAgo = subDays(new Date(), 30)

        while (true) {
            const transactions = await this.prisma.transaction.findMany({
                where: {
                    txStatus: 'Pending',
                    createdAt: {
                        gte: thirtyDaysAgo,
                    },
                },
                take: batchSize,
                skip: transactionsProcessed,
                select: { id: true, txId: true },
            })

            if (transactions.length === 0) {
                break
            }

            for (const transaction of transactions) {
                await this.transactionQueue.add('cron.transaction', { transaction })
            }

            transactionsProcessed += transactions.length
        }
    }
}
