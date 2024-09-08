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
        let matches = 0

        for (let i = 0; i < guess.length; i++) {
            if (guess[i] === outcome[i]) {
                matches++
            }
        }

        if (matches === 0) {
            return 0
        }

        let multiplier = Math.pow(2, matches)
        let points = stake * multiplier

        return points
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async refreshGameTournament() {
        const currentTime = new Date(new Date().toUTCString())

        const currentTournament = await this.prisma.tournament.findFirst({
            where: {
                start: { lte: currentTime },
                end: { gte: currentTime },
            }
        })

        if (currentTournament && currentTournament.paused) {
            return
        }

        if (!currentTournament) {
            const start = currentTime
            const end = new Date(start)
            end.setDate(start.getDate() + 3)

            await this.prisma.tournament.create({
                data: { key: uuidv4(), start, end },
            })
        }
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async refreshSportTournament() {
        const currentTime = new Date(new Date().toUTCString())
        const currentTournament = await this.prisma.sportTournament.findFirst({
            where: {
                start: { lte: currentTime },
                end: { gte: currentTime },
            }
        })

        if (currentTournament && currentTournament.paused) {
            return
        }

        if (!currentTournament) {
            const start = currentTime
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
        let cursorId: string | null = null

        const currentTournament = await this.prisma.sportTournament.findFirst({
            where: {
                start: { lte: new Date(new Date().toUTCString()) },
                end: { gte: new Date(new Date().toUTCString()) },
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
                orderBy: { createdAt: 'desc' },
                ...(cursorId && { cursor: { id: cursorId }, skip: 1 }),
                select: {
                    id: true,
                    fixureId: true
                },
            })

            if (bets.length === 0) {
                break
            }

            const batchIds = bets.map(bet => bet.fixureId).join('-')

            await this.sportQueue.add('sports-football-queue', { batchIds })

            cursorId = bets[bets.length - 1].id

            await new Promise(resolve => setTimeout(resolve, 100))
        }
    }


    @Cron(CronExpression.EVERY_MINUTE)
    async updateTransactions() {
        const batchSize = 200
        let cursorId: string | null = null
        const sevenDaysAgo = subDays(new Date(new Date().toUTCString()), 7)

        while (true) {
            const transactions = await this.prisma.transaction.findMany({
                where: {
                    txStatus: 'Pending',
                    createdAt: {
                        gte: sevenDaysAgo,
                    },
                },
                take: batchSize,
                ...(cursorId && { cursor: { id: cursorId }, skip: 1 }),
                select: { id: true, txId: true },
                orderBy: { createdAt: 'desc' },
            })

            if (transactions.length === 0) {
                break
            }

            for (const transaction of transactions) {
                await this.transactionQueue.add('cron.transaction', { transaction })
            }

            cursorId = transactions[transactions.length - 1].id

            await new Promise(resolve => setTimeout(resolve, 100))
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_4PM)
    async updateLotterySession() {
        const data: contractDTO = {
            contract: 'memegoat-lottery-rng',
            function: 'get-final-number',
            arguments: [],
        }

        const rng = await this.contract.readContract(data)
        const outcome = rng.slice(1).split('').reverse().join('')

        const batchSize = 50
        let cursorId: string | null = null

        while (true) {
            const recentRounds = await this.prisma.round.findMany({
                where: {
                    point: { lte: 0 },
                    game_type: 'LOTTERY',
                },
                take: batchSize,
                ...(cursorId && { cursor: { id: cursorId }, skip: 1 }),
                orderBy: { createdAt: 'desc' },
            })

            const roundsWithNullOutcome = recentRounds.filter(round => round.lottery_outcome_digits === null)

            if (roundsWithNullOutcome.length === 0) {
                break
            }

            await Promise.all(roundsWithNullOutcome.map(async (round) => {
                const points = this.calculateLotteryPoints(round.lottery_digits, outcome, round.stake)

                try {
                    await this.prisma.round.update({
                        where: { id: round.id },
                        data: {
                            point: points,
                            lottery_outcome_digits: outcome,
                        },
                    })

                    await this.prisma.stat.update({
                        where: { userId: round.userId },
                        data: { total_points: { increment: points } },
                    })

                    await new Promise(resolve => setTimeout(resolve, 100))
                } catch (err) {
                    console.error(`Error updating round ${round.id}:`, err)
                }
            }))

            cursorId = recentRounds[recentRounds.length - 1].id

            await new Promise(resolve => setTimeout(resolve, 100))
        }

        await this.prisma.lotteryDraw.create({
            data: { digits: outcome }
        })
    }

    @Cron(CronExpression.EVERY_DAY_AT_6AM)
    async refreshTickets() {
        await this.prisma.stat.updateMany({
            data: { tickets: 500_000 }
        })
    }
}
