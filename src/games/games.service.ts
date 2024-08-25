import { Response } from 'express'
import { Injectable } from '@nestjs/common'
import { StatusCodes } from 'enums/StatusCodes'
import { PaginationDTO } from './dto/pagination'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'

@Injectable()
export class GamesService {
    constructor(
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

    async overallLeaderboard({ limit = 50, page = 1 }: PaginationDTO) {
        page = Number(page)
        limit = Number(limit)

        const offset = (page - 1) * limit

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
            take: limit,
            skip: offset,
        })

        return leaderboard
    }

    async getCurrentTournamentLeaderboard({ limit = 50, page = 1 }: PaginationDTO) {
        page = Number(page)
        limit = Number(limit)

        const offset = (page - 1) * limit

        const currentTournament = await this.prisma.tournament.findFirst({
            where: {
                start: { lte: new Date() },
                end: { gte: new Date() },
            },
        })

        if (!currentTournament) {
            return { leaderboard: [] }
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

        const sortedLeaderboard = leaderboard
            .map((user) => {
                const totalPoints = user.rounds.reduce((acc, round) => acc + round.point, 0)
                return {
                    ...user,
                    totalRounds: user.rounds.length,
                    totalPoints,
                    rounds: undefined,
                }
            })
            .sort((a, b) => b.totalPoints - a.totalPoints)
            .slice(offset, offset + limit)

        return {
            currentTournament,
            leaderboard: sortedLeaderboard,
        }
    }

    async overallPosition(userId?: string) {
        if (userId) {
            const userStat = await this.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    stat: {
                        select: {
                            total_points: true,
                        },
                    },
                },
            })

            const userTotalPoints = userStat.stat.total_points

            const userPosition = await this.prisma.user.count({
                where: {
                    active: true,
                    stat: {
                        total_points: {
                            gte: userTotalPoints,
                        },
                    },
                },
            })

            return userPosition
        }
    }

    async tournamentPosition(userId?: string): Promise<number | null> {
        let position: null | number = null

        if (userId) {
            const currentTournament = await this.prisma.tournament.findFirst({
                where: {
                    start: { lte: new Date() },
                    end: { gte: new Date() },
                },
            })

            if (!currentTournament) {
                return null
            }

            const userPoints = await this.prisma.round.groupBy({
                by: ['userId'],
                _sum: {
                    point: true,
                },
                where: {
                    user: {
                        rounds: {
                            some: {
                                createdAt: {
                                    gte: currentTournament.start,
                                    lte: currentTournament.end,
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    _sum: {
                        point: 'desc',
                    },
                },
            })

            position = userPoints.findIndex((user) => user.userId === userId) + 1

            position = position > 0 ? position : null
        }

        return position
    }
}
