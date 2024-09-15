import {
    PlaceNFLBetDTO,
    FetchFixturesDTO,
    PlaceFootballBetDTO,
} from './sports.dto'
import { Queue } from 'bullmq'
import {
    Injectable,
    ConflictException,
    NotFoundException,
    BadRequestException,
    UnprocessableEntityException,
} from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { ApiService } from 'libs/api.service'
import { Prisma, SportType } from '@prisma/client'
import { PrismaService } from 'prisma/prisma.service'
import { PaginationDTO } from 'src/games/dto/pagination'

@Injectable()
export class SportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly apiService: ApiService,
        @InjectQueue('current-tournament-queue') private tournamentQueue: Queue,
    ) { }

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

    async fetchFixtures({ page = 1, limit = 20, timezone, leagueId }: FetchFixturesDTO) {
        page = Number(page)
        limit = Number(limit)

        const params = new URLSearchParams()

        if (leagueId) {
            params.append('league', leagueId)
            params.append('season', new Date(new Date().toUTCString()).getFullYear().toString())
        }

        if (timezone) {
            params.append('timezone', timezone)
            params.append('live', 'all')
        }

        if (!timezone && !leagueId) {
            params.append('live', 'all')
        }

        let fixtures: FootballMatchResponse[] = []

        const data = await this.apiService.apiSportGET<any>(`/fixtures?${params.toString()}`)
        fixtures = data.response

        fixtures = fixtures.filter((fixture) => {
            const elapsed = fixture.fixture.status?.elapsed || 0
            if (elapsed <= 5) {
                return fixture
            }
        })

        return this.paginateArray<FootballMatchResponse>(fixtures, page, limit)
    }

    async fetchNFLGames({ page = 0, limit = 0 }: PaginationDTO) {
        let fixtures: NFLResponse[] = []
        const data = await this.apiService.apiSportGET<any>(`/games?league=1&season=${new Date(new Date().toUTCString()).getFullYear()}`)
        fixtures = data.response

        fixtures = fixtures.filter((fixture) => {
            const status = fixture.game.status.short
            if (status === "NS ") {
                return fixture
            }
        })

        return this.paginateArray<NFLResponse>(fixtures, page, limit)
    }

    async placeFootballBet(
        { sub: userId }: ExpressUser,
        { stake, placebetOutcome, fixtureId }: PlaceFootballBetDTO
    ) {
        const placedBetAlready = await this.prisma.sportBet.findFirst({
            where: {
                fixureId: fixtureId.toString(),
                userId,
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

        const currentTournament = await this.prisma.currentSportTournament()

        if (!currentTournament) {
            throw new UnprocessableEntityException("No ongoing tournament")
        }

        const now = new Date(new Date().toUTCString())
        const timeLeft = (new Date(currentTournament.end).getTime() - now.getTime()) / (1000 * 60)

        const THRESHOLD = 10

        let formattedTime = timeLeft > 60 ? `${Math.floor(timeLeft / 60)} Hrs` : `${timeLeft} minutes`

        if (timeLeft <= THRESHOLD) {
            throw new UnprocessableEntityException(`The current tournament will end in ${formattedTime}. You can't place a bet.`)
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

        let res = await this.apiService.apiSportGET<any>(`/fixtures?id=${fixtureId}`)
        const fixture = res.response as FootballMatchResponse[]

        if (fixture.length === 0) {
            throw new NotFoundException("Fixture not found")
        }

        const game = fixture[0]
        const elapsed = game.fixture.status?.elapsed || 0
        if (elapsed > 5) {
            throw new UnprocessableEntityException("The match has already begun")
        }

        const bet = await this.prisma.sportBet.create({
            data: {
                outcome: 'NOT_DECIDED',
                potentialWin, placebetOutcome,
                sport_type: SportType.FOOTBALL,
                fixureId: fixtureId.toString(),
                stake, elapsed: elapsed.toString(),
                status: elapsed > 0 ? 'ONGOING' : 'NOT_STARTED',
                goals: {
                    away: game.goals.away,
                    home: game.goals.home,
                },
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
                league: {
                    name: game.league.name,
                    flag: game.league.flag,
                    logo: game.league.logo,
                    country: game.league.country,
                    id: game.league.id.toString(),
                    season: game.league.season.toString()
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
        })

        if (bet) {
            await this.prisma.stat.update({
                where: { userId },
                data: {
                    tickets: { decrement: stake }
                }
            })

            await this.prisma.sportTournament.update({
                where: { id: currentTournament.id },
                data: { totalStakes: { increment: stake } }
            })

            await this.tournamentQueue.add('sport', {
                stake, userId,
                id: currentTournament.id,
                end: currentTournament.end,
                start: currentTournament.start,
            })
        }

        return bet
    }

    async placeNFLBet(
        { sub: userId }: ExpressUser,
        { stake, placebetOutcome, gameId }: PlaceNFLBetDTO
    ) {
        const placedBetAlready = await this.prisma.sportBet.findFirst({
            where: {
                userId,
                gameId: gameId.toString(),
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
                potentialWin = stake * 10
                break
            default:
                throw new BadRequestException("Invalid bet outcome")
        }

        const currentTournament = await this.prisma.currentSportTournament()

        if (!currentTournament) {
            throw new UnprocessableEntityException("No ongoing tournament")
        }

        const now = new Date(new Date().toUTCString())
        const timeLeft = (new Date(currentTournament.end).getTime() - now.getTime()) / (1000 * 60)

        const THRESHOLD = 300

        let formattedTime = timeLeft > 60 ? `${Math.floor(timeLeft / 60)} Hrs` : `${timeLeft} minutes`

        if (timeLeft <= THRESHOLD) {
            throw new UnprocessableEntityException(`The current tournament will end in ${formattedTime}. You can't place a bet.`)
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

        let res = await this.apiService.apiSportGET<any>(`/fixtures?id=${gameId}`)
        const fixture = res.response as NFLResponse[]

        if (fixture.length === 0) {
            throw new NotFoundException("Fixture not found")
        }

        const game = fixture[0]

        if (game.game.status.short !== "NS") {
            throw new BadRequestException("Sorry, you can't bet on this game right now")
        }

        const bet = await this.prisma.sportBet.create({
            data: {
                outcome: 'NOT_DECIDED',
                sport_type: SportType.NFL,
                fixureId: gameId.toString(),
                potentialWin, placebetOutcome,
                stake, elapsed: game.game.status.timer,
                status: 'NOT_STARTED',
                goals: {
                    away: game.scores.away.total,
                    home: game.scores.home.total,
                },
                teams: {
                    home: {
                        name: game.teams.home.name,
                        logo: game.teams.home.logo,
                        id: game.teams.home.id.toString(),
                    },
                    away: {
                        name: game.teams.away.name,
                        logo: game.teams.away.logo,
                        id: game.teams.away.id.toString(),
                    }
                },
                league: {
                    name: game.league.name,
                    logo: game.league.logo,
                    id: game.league.id.toString(),
                    country: game.league.country.name,
                    season: game.league.season.toString()
                },
                sportRound: {
                    create: {
                        stake, sport_type: 'NFL',
                        user: { connect: { id: userId } }
                    }
                },
                user: { connect: { id: userId } },
            },
            include: {
                sportRound: true
            }
        })

        if (bet) {
            await this.prisma.stat.update({
                where: { userId },
                data: {
                    tickets: { decrement: stake }
                }
            })

            await this.tournamentQueue.add('sport', {
                stake, userId,
                id: currentTournament.id,
                end: currentTournament.end,
                start: currentTournament.start,
            })
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

        const whereClause = {
            active: true,
            stat: {
                total_sport_points: { gte: 1 }
            }
        } as Prisma.UserWhereInput

        const totalUsers = await this.prisma.user.count({
            where: whereClause,
        })

        const { _sum } = await this.prisma.stat.aggregate({
            where: { user: whereClause },
            _sum: { total_sport_points: true },
        })

        const leaderboard = await this.prisma.user.findMany({
            where: whereClause,
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

    async getCurrentTournamentLeaderboard({ limit = 50, page = 1 }: PaginationDTO) {
        page = Number(page)
        limit = Number(limit)

        const offset = (page - 1) * limit

        const currentTournament = await this.prisma.currentSportTournament()

        if (!currentTournament) {
            return {
                leaderboard: [],
                totalPages: 0,
                hasNext: false,
                hasPrev: false
            }
        }

        const whereClause = {
            active: true,
            stat: {
                total_sport_points: { gte: 1 }
            }
        } as Prisma.UserWhereInput

        const totalUsers = await this.prisma.user.count({
            where: {
                ...whereClause,
                sportRounds: {
                    some: {
                        updatedAt: {
                            gte: currentTournament.start,
                            lte: currentTournament.end,
                        },
                    },
                },
            },
        })

        const leaderboard = await this.prisma.user.findMany({
            where: {
                ...whereClause,
                sportRounds: {
                    some: {
                        updatedAt: {
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
                        updatedAt: {
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
                    sportRounds: undefined,
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

        const whereClause = {
            active: true,
            stat: {
                total_sport_points: { gte: 1 }
            }
        } as Prisma.UserWhereInput

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
                    ...whereClause,
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
            const currentTournament = await this.prisma.currentSportTournament()
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
                        active: true,
                        sportRounds: {
                            some: {
                                updatedAt: {
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
