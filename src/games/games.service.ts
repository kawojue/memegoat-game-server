import { Response } from 'express'
import { Injectable } from '@nestjs/common'
import { MiscService } from 'libs/misc.service'
import { StatusCodes } from 'enums/StatusCodes'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'

@Injectable()
export class GamesService {
    constructor(
        private readonly misc: MiscService,
        private readonly prisma: PrismaService,
        private readonly response: ResponseService,
    ) { }

    async buyTicket(res: Response, { sub }: ExpressUser) {
        /* Some Web3 CONTRACT TRANSACTIONS STUFF HERE */

        /* Assuming 100 tickets equal $0.05 */

        const qty = 100

        await this.prisma.stat.update({
            where: { userId: sub },
            data: { tickets: { increment: qty } }
        })

        this.response.sendSuccess(res, StatusCodes.OK, {})
    }

    async overallLeaderboard(userId?: string) {
        const leaderboard = await this.prisma.user.findMany({
            where: { active: true },
            select: {
                id: true,
                stat: {
                    select: {
                        total_points: true,
                    },
                },
                avatar: true,
                address: true,
                username: true,
            },
            orderBy: {
                stat: {
                    total_points: 'desc',
                },
            },
            take: 100,
        })

        let userPosition: number | null = null

        if (userId) {
            const userIndex = leaderboard.findIndex((u) => u.id === userId)

            if (userIndex !== -1) {
                userPosition = userIndex + 1
            }
        }

        return { leaderboard, userPosition }
    }

    async getCurrentTournamentLeaderboard(userId?: string) {
        const currentTournament = await this.prisma.tournament.findFirst({
            where: {
                start: { lte: new Date() },
                end: { gte: new Date() },
            },
        })

        if (!currentTournament) {
            return { leaderboard: [], userPosition: null }
        }

        const leaderboard = await this.prisma.user.findMany({
            where: {
                rounds: {
                    some: {
                        createdAt: {
                            gte: currentTournament.start,
                            lte: currentTournament.end,
                        },
                    },
                },
            },
            select: {
                id: true,
                avatar: true,
                address: true,
                username: true,
                rounds: {
                    where: {
                        createdAt: {
                            gte: currentTournament.start,
                            lte: currentTournament.end,
                        },
                    },
                    select: {
                        point: true,
                    },
                },
            },
        })

        const sortedLeaderboard = leaderboard.map((user) => {
            const totalPoints = user.rounds.reduce(
                (acc, round) => acc + round.point,
                0,
            )
            return {
                ...user,
                totalRounds: user.rounds.length,
                totalPoints,
                rounds: undefined,
            }
        })

        sortedLeaderboard.sort((a, b) => b.totalPoints - a.totalPoints)

        let userPosition: number | null = null

        if (userId) {
            const userIndex = sortedLeaderboard.findIndex((u) => u.id === userId)

            if (userIndex !== -1) {
                userPosition = userIndex + 1
            }
        }

        return {
            currentTournament,
            leaderboard: sortedLeaderboard,
            userPosition,
        }
    }
}
