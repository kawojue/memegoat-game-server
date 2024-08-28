import {
    Injectable,
    ConflictException,
    NotFoundException,
    BadRequestException,
    UnprocessableEntityException,
} from '@nestjs/common'
import { SportRound } from '@prisma/client'
import { ApiService } from 'libs/api.service'
import { PrismaService } from 'prisma/prisma.service'
import { PaginationDTO } from 'src/games/dto/pagination'
import { FetchFixturesDTO, PlacebetDTO } from './sports.dto'

@Injectable()
export class SportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly apiService: ApiService,
    ) { }

    private async currentTournament() {
        return await this.prisma.sportTournament.findFirst({
            where: {
                paused: false,
                start: { lte: new Date() },
                end: { gte: new Date() },
            }
        })
    }

    private paginateArray<T>(array: Array<T>, page = 1, limit = 10) {
        const offset = (page - 1) * limit
        const paginatedItems = array.slice(offset, offset + limit)

        return {
            page,
            limit,
            totalItems: array.length,
            totalPages: Math.ceil(array.length / limit),
            items: paginatedItems
        }
    }

    private async updateUniqueUsersForCurrentTournament(
        tournamentId: string,
        userId: string,
        start: Date,
        end: Date,
    ) {
        const rounds = await this.prisma.sportRound.count({
            where: {
                userId,
                createdAt: {
                    gte: start,
                    lte: end,
                }
            }
        })

        /*
        Used less than or equal-to one because
        I am saving it after the first round has been saved.
        */
        if (rounds <= 1) {
            await this.prisma.sportTournament.update({
                where: { id: tournamentId },
                data: { uniqueUsers: { increment: 1 } }
            })
        }
    }

    async fetchFixtures({ page = 1, limit = 20, timezone, leagueId }: FetchFixturesDTO) {
        page = Number(page)
        limit = Number(limit)

        let fixtures: FootballMatchResponse[] = []

        if (leagueId) {
            const data = await this.apiService.apiSportGET<any>(`/fixtures?league=${leagueId}&season=${new Date().getFullYear()}`)
            fixtures = data.response
        } else if (timezone) {
            const data = await this.apiService.apiSportGET<any>(`/fixtures?live=all&timezone=${timezone}`)
            fixtures = data.response
        } else {
            const data = await this.apiService.apiSportGET<any>(`/fixtures?live=all`)
            fixtures = data.response
        }

        return this.paginateArray<FootballMatchResponse>(fixtures, page, limit)
    }

    async placeBet(
        { sub: userId }: ExpressUser,
        { stake, placebetOutcome, fixtureId }: PlacebetDTO
    ) {
        const placedBetAlready = await this.prisma.sportBet.findUnique({
            where: {
                fixureId_userId: {
                    userId,
                    fixureId: fixtureId.toString(),
                }
            }
        })

        if (placedBetAlready) {
            throw new ConflictException("Same bet placed already")
        }

        let potentialWin = 0
        switch (placebetOutcome) {
            case 'away':
            case 'home':
                potentialWin = stake * 2
                break

            case 'draw':
                potentialWin = stake * 3
                break
            default:
                throw new BadRequestException("Invalid bet outcome")
        }

        const currentTournament = await this.currentTournament()

        if (!currentTournament) {
            throw new UnprocessableEntityException("No ongoing tournament")
        }

        const now = new Date()
        const timeLeft = (new Date(currentTournament.end).getTime() - now.getTime()) / (1000 * 60)

        if (timeLeft <= 120) {
            throw new UnprocessableEntityException(`The current tournament will end in ${Math.ceil(timeLeft)} minutes. You can't place a bet.`)
        }

        const stat = await this.prisma.stat.findFirst({
            where: {
                userId,
                tickets: { gte: stake }
            },
        })

        if (!stat) {
            throw new UnprocessableEntityException("Insufficient tickets")
        }

        const fixture = await this.apiService.apiSportGET<any>(`/fixtures?id=${fixtureId}`)
        const game = fixture.response as FootballMatchResponse

        if (!game) {
            throw new NotFoundException("Fixture not found")
        }

        const elapsed = game.fixture.status.elapsed || 0
        if (elapsed > 20) {
            throw new UnprocessableEntityException("The match has started already")
        }

        const [bet] = await this.prisma.$transaction([
            this.prisma.sportBet.create({
                data: {
                    stake, status: 'ONGOING',
                    fixureId: fixtureId.toString(),
                    outcome: 'NOT_DECIDED', elapsed,
                    goals: {
                        away: game.goals.away,
                        home: game.goals.away,
                    },
                    potentialWin,
                    placebetOutcome,
                    teams: {
                        home: {
                            name: game.teams.home.name,
                            logo: game.teams.home.logo,
                            winner: game.teams.home.winner,
                            id: game.teams.home.id.toString(),
                        },
                        away: {
                            name: game.teams.away.name,
                            logo: game.teams.away.logo,
                            winner: game.teams.away.winner,
                            id: game.teams.away.id.toString(),
                        }
                    },
                    sportRound: {
                        create: {
                            stake, sport_type: 'FOOTBALL',
                            user: { connect: { id: userId } }
                        }
                    },
                    user: { connect: { id: userId } },
                },
                include: {
                    sportRound: true
                }
            }),
            this.prisma.stat.update({
                where: { userId },
                data: {
                    tickets: { decrement: stake }
                }
            }),
        ])

        if (bet) {
            await this.updateUniqueUsersForCurrentTournament(
                currentTournament.id, userId,
                currentTournament.start,
                currentTournament.end,
            )
        }

        return bet
    }

    async fetchUserBets(
        { sub: userId }: ExpressUser,
        { page = 1, limit = 20 }: PaginationDTO
    ) {
        page = Number(page)
        limit = Number(limit)

        const offset = (page - 1) * limit

        return await this.prisma.sportBet.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            skip: offset,
            take: limit
        })
    }


    async overallLeaderboard({ limit = 50, page = 1 }: PaginationDTO) {
        page = Number(page)
        limit = Number(limit)

        const offset = (page - 1) * limit

        const totalUsers = await this.prisma.user.count({
            where: { active: true },
        })

        const { _sum } = await this.prisma.stat.aggregate({
            where: { user: { active: true } },
            _sum: { total_sport_points: true },
        })

        const leaderboard = await this.prisma.user.findMany({
            where: {
                active: true,
                stat: {
                    total_sport_points: { gte: 1 }
                }
            },
            select: {
                id: true,
                stat: {
                    select: {
                        total_sport_points: true,
                    },
                },
                avatar: true,
                address: true,
                username: true,
            },
            orderBy: {
                stat: {
                    total_sport_points: 'desc',
                },
            },
            take: limit,
            skip: offset,
        })

        const totalPages = Math.ceil(totalUsers / limit)
        const hasNext = page < totalPages
        const hasPrev = page > 1

        return {
            totalPoints: _sum,
            leaderboard,
            totalPages,
            hasNext,
            hasPrev,
        }
    }

    async getCurrentTournamentLeaderboard({
        limit = 50,
        page = 1,
    }: PaginationDTO) {
        page = Number(page)
        limit = Number(limit)

        const offset = (page - 1) * limit

        const currentTournament = await this.currentTournament()

        if (!currentTournament) {
            return { leaderboard: [], totalPages: 0, hasNext: false, hasPrev: false }
        }

        const totalUsers = await this.prisma.user.count({
            where: {
                active: true,
                sportRounds: {
                    some: {
                        createdAt: {
                            gte: currentTournament.start,
                            lte: currentTournament.end,
                        },
                    },
                },
            },
        })

        const leaderboard = await this.prisma.user.findMany({
            where: {
                active: true,
                sportRounds: {
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
                sportRounds: {
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

        let totalTournamentPoints = 0
        const sortedLeaderboard = leaderboard
            .map((user) => {
                const totalPoints = user.sportRounds.reduce(
                    (acc, round) => acc + round.point,
                    0,
                )
                totalTournamentPoints += totalPoints
                return {
                    ...user,
                    totalPoints,
                    totalRounds: user.sportRounds.length,
                    rounds: undefined,
                }
            })
            .sort((a, b) => b.totalPoints - a.totalPoints)
            .slice(offset, offset + limit)

        const totalPages = Math.ceil(totalUsers / limit)
        const hasNext = page < totalPages
        const hasPrev = page > 1

        return {
            hasNext,
            hasPrev,
            totalUsers,
            totalPages,
            currentTournament,
            totalTournamentPoints,
            leaderboard: sortedLeaderboard,
        }
    }

    async overallLeaderboardPosition(userId?: string) {
        let userTotalPoints = 0
        let userPosition: null | number = null

        if (userId) {
            const userStat = await this.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    stat: {
                        select: {
                            total_sport_points: true,
                        },
                    },
                },
            })

            userTotalPoints = userStat.stat.total_sport_points

            userPosition = await this.prisma.user.count({
                where: {
                    active: true,
                    stat: {
                        total_sport_points: {
                            gte: userTotalPoints,
                        },
                    },
                },
            })
        }

        return { userPosition, userTotalPoints }
    }

    async tournamentPosition(userId?: string) {
        let position = 0
        let userPoints = 0

        if (userId) {
            const currentTournament = await this.currentTournament()

            if (!currentTournament) {
                return null
            }

            const userScores = await this.prisma.sportRound.groupBy({
                by: ['userId'],
                _sum: {
                    point: true,
                },
                where: {
                    user: {
                        sportRounds: {
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

            const userEntry = userScores.find((user) => user.userId === userId)

            if (userEntry) {
                userPoints = userEntry._sum.point
                position = userScores.findIndex((user) => user.userId === userId) + 1
            }

            position = position > 0 ? position : null
        }

        return { position, userPoints }
    }
}
