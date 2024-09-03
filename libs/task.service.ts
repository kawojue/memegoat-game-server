import { Queue } from 'bullmq'
import { subDays } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { PrismaService } from 'prisma/prisma.service'
import { Cron, CronExpression } from '@nestjs/schedule'
import { contractDTO, ContractService } from './contract.service'

@Injectable()
export class TaskService {
    constructor(
        private prisma: PrismaService,
        private contract: ContractService,
        @InjectQueue('sports-football-queue') private sportQueue: Queue,
        @InjectQueue('transactions-queue') private transactionQueue: Queue,
    ) { }

    calculateLotteryPoints(guess: string, outcome: string, stake: number): number {
        const formattedOutcome = outcome.slice(1).split('').reverse().join('')

        let matches = 0

        for (let i = 0; i < guess.length; i++) {
            if (guess[i] === formattedOutcome[i]) {
                matches++
            }
        }
        const probability = 1 / 10
        const points = stake * Math.pow(1 / probability, matches)

        return points
    }

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

    @Cron(CronExpression.EVERY_MINUTE)
    async triggerFootballBets() {
        const batchSize = 19 // max is 20, I am just being skeptical
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
                    fixureId: { not: null },
                    status: { in: ['ONGOING', 'NOT_STARTED'] },
                },
                take: batchSize,
                skip: betsProcessed,
                select: { fixureId: true },
            })

            if (bets.length === 0) {
                break
            }

            const batchIds = bets.map(bet => bet.fixureId).join('-')

            await this.sportQueue.add('sports-football-queue', { batchIds })

            betsProcessed += bets.length

            await new Promise(resolve => setTimeout(resolve, 100))
        }
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async updateTransactions() {
        const batchSize = 200
        let transactionsProcessed = 0
        const sevenDaysAgo = subDays(new Date(), 7)

        while (true) {
            const transactions = await this.prisma.transaction.findMany({
                where: {
                    txStatus: 'Pending',
                    createdAt: {
                        gte: sevenDaysAgo,
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

            await new Promise(resolve => setTimeout(resolve, 100))
        }
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async updateLotterySession() {
        const data: contractDTO = {
            contract: 'memegoat-lottery-rng',
            function: 'get-final-number',
            arguments: [],
        }

        const rng = await this.contract.readContract(data)

        const batchSize = 20
        let roundsProcessed = 0

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

        while (true) {
            const recentRounds = await this.prisma.round.findMany({
                where: {
                    createdAt: {
                        gte: twentyFourHoursAgo,
                    },
                    point: { lte: 0 }
                },
                take: batchSize,
                skip: roundsProcessed,
                orderBy: { createdAt: 'desc' },
            })

            if (recentRounds.length === 0) {
                break
            }

            await Promise.all(recentRounds.map(async (round) => {
                const points = this.calculateLotteryPoints(round.lottery_digits, rng, round.stake)

                await this.prisma.round.update({
                    where: { id: round.id },
                    data: { point: points },
                })
            }))

            roundsProcessed += recentRounds.length

            await new Promise(resolve => setTimeout(resolve, 100))
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_6AM)
    async refreshTickets() {
        await this.prisma.stat.updateMany({
            data: { tickets: 500_000 }
        })
    }
}
