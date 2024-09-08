import { Response } from 'express'
import { Injectable } from '@nestjs/common'
import { StatusCodes } from 'enums/StatusCodes'
import { MiscService } from 'libs/misc.service'
import { PaginationDTO } from './dto/pagination'
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
      data: { tickets: { increment: qty } },
    })

    this.response.sendSuccess(res, StatusCodes.OK, {})
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
      _sum: { total_points: true },
    })

    const leaderboard = await this.prisma.user.findMany({
      where: {
        active: true,
        stat: {
          total_points: { gte: 1 }
        }
      },
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

    const currentTournament = await this.prisma.tournament.findFirst({
      where: {
        start: { lte: new Date(new Date().toUTCString()) },
        end: { gte: new Date(new Date().toUTCString()) },
      },
    })

    if (!currentTournament) {
      return {
        leaderboard: [],
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      }
    }

    const totalUsers = await this.prisma.user.count({
      where: {
        active: true,
        rounds: {
          some: {
            point: { gte: 1 },
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
        rounds: {
          some: {
            point: { gte: 1 },
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
            point: { gte: 1 },
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
        const totalPoints = user.rounds.reduce(
          (acc, round) => acc + round.point,
          0,
        )
        totalTournamentPoints += totalPoints
        return {
          ...user,
          totalPoints,
          totalRounds: user.rounds.length,
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

  async overallPosition(userId?: string) {
    let userTotalPoints = 0
    let userPosition: null | number = null

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

      userTotalPoints = userStat.stat.total_points

      userPosition = await this.prisma.user.count({
        where: {
          active: true,
          stat: {
            total_points: {
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
      const currentTournament = await this.prisma.tournament.findFirst({
        where: {
          paused: false,
          start: { lte: new Date(new Date().toUTCString()) },
          end: { gte: new Date(new Date().toUTCString()) },
        },
      })

      if (!currentTournament) {
        return null
      }

      const userScores = await this.prisma.round.groupBy({
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

      const userEntry = userScores.find((user) => user.userId === userId)

      if (userEntry) {
        userPoints = userEntry._sum.point
        position = userScores.findIndex((user) => user.userId === userId) + 1
      }

      position = position > 0 ? position : null
    }

    return { position, userPoints }
  }

  async fetchLotteryHistories(
    { sub: userId }: ExpressUser,
    { page, limit }: PaginationDTO,
  ) {
    page = Number(page)
    limit = Number(limit)

    const offset = (page - 1) * limit

    return await this.prisma.round.findMany({
      where: {
        userId,
        game_type: 'LOTTERY',
      },
      take: limit,
      skip: offset,
      orderBy: { updatedAt: 'desc' }
    })
  }

  fetchSpaceInvaderLives() {
    const size = 3

    const lives: {
      lives: number
      tickets: number
    }[] = []

    for (let i = 0; i < size; i++) {
      lives.push({
        lives: i + 1,
        tickets: this.misc.calculateSpaceInvaderTicketByLives(i + 1)
      })
    }

    return lives
  }
}
