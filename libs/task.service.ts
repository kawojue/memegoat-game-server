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
        @InjectQueue('sports-queue') private readonly sportQueue: Queue,
        @InjectQueue('transactions-queue') private readonly transactionQueue: Queue,
    ) { }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async refreshGameTournament() {
        const currentTournament = await this.prisma.tournament.findFirst({
            where: {
                start: { lte: new Date() },
                end: { gte: new Date() },
            }
        })

        if (currentTournament && currentTournament.paused) {
            return
        }

        if (!currentTournament) {
            const start = new Date()
            const end = new Date(start)
            end.setDate(start.getDate() + 3)

            await this.prisma.tournament.create({
                data: { key: uuidv4(), start, end },
            })
        }
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async refreshSportTournament() {
        const currentTournament = await this.prisma.sportTournament.findFirst({
            where: {
                start: { lte: new Date() },
                end: { gte: new Date() },
            }
        })

        if (currentTournament && currentTournament.paused) {
            return
        }

        if (!currentTournament) {
            const start = new Date()
            const end = new Date(start)
            end.setDate(start.getDate() + 7)

            await this.prisma.sportTournament.create({
                data: { key: uuidv4(), start, end },
            })
        }
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async SPORT() {
        const batchSize = 17 // max is 20, I am just being skeptical
        let betsProcessed = 0

        const currentTournament = await this.prisma.sportTournament.findFirst({
            where: {
                start: { lte: new Date() },
                end: { gte: new Date() },
            }
        })

        if (!currentTournament || (currentTournament && currentTournament.paused)) {
            return
        }

        while (true) {
            const bets = await this.prisma.sportBet.findMany({
                where: {
                    outcome: 'NOT_DECIDED',
                    status: 'ONGOING',
                    updatedAt: {
                        gte: currentTournament.start,
                        lte: currentTournament.end,
                    },
                },
                take: batchSize,
                skip: betsProcessed,
                select: { id: true },
            })

            if (bets.length === 0) {
                break
            }

            const batchIds = bets.map(bet => bet.id).join('-')

            await this.sportQueue.add('cron.sport', { batchIds })

            betsProcessed += bets.length
        }
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
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

    @Cron(CronExpression.EVERY_DAY_AT_6AM)
    async refreshTickets() {
        await this.prisma.stat.updateMany({
            data: { tickets: 500_000 }
        })
    }
}
