import { Queue } from 'bullmq'
import { subDays } from 'date-fns'
import { v4 as uuidv4 } from 'uuid'
import { Prisma } from '@prisma/client'
import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { PrismaService } from 'prisma/prisma.service'
import { Cron, CronExpression } from '@nestjs/schedule'
import { contractDTO, ContractService } from 'libs/contract.service'

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
    async refreshFootballBets() {
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

    @Cron(CronExpression.EVERY_5_MINUTES)
    async updateTransactions() {
        const batchSize = 100
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

    @Cron(CronExpression.EVERY_DAY_AT_4PM, {
        timeZone: 'UTC',
    })
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
            const twentyFourHoursAgo = new Date(new Date().getTime() - 24 * 60 * 60 * 1000)

            const recentRounds = await this.prisma.round.findMany({
                where: {
                    point: { lte: 0 },
                    game_type: 'LOTTERY',
                    createdAt: {
                        gte: twentyFourHoursAgo
                    },
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

                await this.prisma.retryTransaction(async () => {
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
                })

                await new Promise(resolve => setTimeout(resolve, 100))
            }))

            cursorId = recentRounds[recentRounds.length - 1].id

            await new Promise(resolve => setTimeout(resolve, 100))
        }

        await this.prisma.lotteryDraw.create({
            data: { digits: outcome }
        })
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async rewardGamePlay() {
        const currentTime = new Date(new Date().toUTCString())

        const whereClause: Prisma.TournamentWhereInput = {
            OR: [
                {
                    end: {
                        lte: new Date(currentTime.getTime() + 10 * 60 * 1000),
                        gte: currentTime,
                    },
                },
                {
                    end: {
                        lte: currentTime,
                    },
                },
            ],
            paused: false,
            disbursed: false,
        }

        const tournamentsToProcess = await this.prisma.tournament.findMany({
            where: whereClause,
        })

        for (const tournament of tournamentsToProcess) {
            await this.prisma.retryTransaction(async () => {
                await this.prisma.$transaction(async (prisma) => {
                    await prisma.tournament.update({
                        where: { id: tournament.id },
                        data: { paused: true },
                    })

                    const leaderboard = await prisma.user.findMany({
                        where: {
                            active: true,
                            rounds: {
                                some: {
                                    point: { gte: 1 },
                                    createdAt: {
                                        gte: tournament.start,
                                        lte: tournament.end,
                                    },
                                },
                            },
                        },
                        select: {
                            id: true,
                            rounds: {
                                where: {
                                    createdAt: {
                                        gte: tournament.start,
                                        lte: tournament.end,
                                    },
                                },
                                select: {
                                    point: true,
                                },
                            },
                        },
                    })

                    let totalTournamentPoints = 0
                    const leaderboardWithPoints = leaderboard.map((user) => {
                        const totalPoints = user.rounds.reduce(
                            (acc, round) => acc + round.point,
                            0
                        )
                        totalTournamentPoints += totalPoints
                        return { ...user, totalPoints }
                    })

                    const sortedLeaderboard = leaderboardWithPoints.sort(
                        (a, b) => b.totalPoints - a.totalPoints
                    )

                    const numberOfUsersToReward = Math.ceil(tournament.uniqueUsers / 10)

                    const usersToReward = sortedLeaderboard.slice(0, numberOfUsersToReward)

                    const totalStakes = tournament.totalStakes

                    for (const user of usersToReward) {
                        const userProportion = user.totalPoints / totalTournamentPoints
                        const userEarnings = totalStakes * userProportion

                        await prisma.reward.create({
                            data: {
                                userId: user.id,
                                earning: userEarnings,
                                totalTournamentPoints,
                                points: user.totalPoints,
                                claimed: false, type: 'GAME',
                                gameTournamentId: tournament.id,
                            },
                        })
                    }

                    await prisma.tournament.update({
                        where: { id: tournament.id },
                        data: {
                            disbursed: true,
                            numberOfUsersRewarded: usersToReward.length,
                        },
                    })
                })
            }, 2)
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async rewardSportBet() {
        const currentTime = new Date(new Date().toUTCString())

        const whereClause: Prisma.SportTournamentWhereInput = {
            OR: [
                {
                    end: {
                        lte: new Date(currentTime.getTime() + 10 * 60 * 1000),
                        gte: currentTime,
                    },
                },
                {
                    end: {
                        lte: currentTime,
                    },
                },
            ],
            paused: false,
            disbursed: false,
        }

        const tournamentsToProcess = await this.prisma.sportTournament.findMany({
            where: whereClause,
        })

        for (const tournament of tournamentsToProcess) {
            await this.prisma.retryTransaction(async () => {
                await this.prisma.$transaction(async (prisma) => {
                    await prisma.sportTournament.update({
                        where: { id: tournament.id },
                        data: { paused: true },
                    })

                    const leaderboard = await prisma.user.findMany({
                        where: {
                            active: true,
                            sportRounds: {
                                some: {
                                    point: { gte: 1 },
                                    createdAt: {
                                        gte: tournament.start,
                                        lte: tournament.end,
                                    },
                                },
                            },
                        },
                        select: {
                            id: true,
                            sportRounds: {
                                where: {
                                    createdAt: {
                                        gte: tournament.start,
                                        lte: tournament.end,
                                    },
                                },
                                select: {
                                    point: true,
                                },
                            },
                        },
                    })

                    let totalTournamentPoints = 0
                    const leaderboardWithPoints = leaderboard.map((user) => {
                        const totalPoints = user.sportRounds.reduce(
                            (acc, round) => acc + round.point,
                            0
                        )
                        totalTournamentPoints += totalPoints
                        return { ...user, totalPoints }
                    })

                    const sortedLeaderboard = leaderboardWithPoints.sort(
                        (a, b) => b.totalPoints - a.totalPoints
                    )

                    const numberOfUsersToReward = Math.ceil(tournament.uniqueUsers / 10)

                    const usersToReward = sortedLeaderboard.slice(0, numberOfUsersToReward)

                    const totalStakes = tournament.totalStakes

                    for (const user of usersToReward) {
                        const userProportion = user.totalPoints / totalTournamentPoints
                        const userEarnings = totalStakes * userProportion

                        await prisma.reward.create({
                            data: {
                                userId: user.id,
                                earning: userEarnings,
                                totalTournamentPoints,
                                points: user.totalPoints,
                                claimed: false, type: 'SPORT',
                                gameTournamentId: tournament.id,
                            },
                        })
                    }

                    await prisma.sportTournament.update({
                        where: { id: tournament.id },
                        data: {
                            disbursed: true,
                            numberOfUsersRewarded: usersToReward.length,
                        },
                    })
                })
            }, 2)
        }
    }
}
