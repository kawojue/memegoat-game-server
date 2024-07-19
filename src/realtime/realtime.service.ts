import { Server } from 'socket.io'
import { Injectable } from '@nestjs/common'
import { PrismaService } from 'prisma/prisma.service'

@Injectable()
export class RealtimeService {
    private server: Server

    constructor(private readonly prisma: PrismaService) { }

    setServer(server: Server) {
        this.server = server
    }

    getServer(): Server {
        return this.server
    }

    async leaderboard() {
        await Promise.all([
            this.updateOverallLeaderboard(),
            this.getCurrentTournamentLeaderboard()
        ])
    }

    private async updateOverallLeaderboard() {
        const leaderboard = await this.prisma.user.findMany({
            where: { active: true },
            select: {
                id: true,
                stat: {
                    select: {
                        total_points: true,
                    }
                },
                avatar: true,
                address: true,
                username: true,
            },
            orderBy: {
                stat: {
                    total_points: 'desc'
                }
            }
        })

        this.getServer().emit('overall-leaderboard', { leaderboard })
    }

    private async getCurrentTournamentLeaderboard() {
        const currentTournament = await this.prisma.tournament.findFirst({
            where: {
                start: { lte: new Date() },
                end: { gte: new Date() },
            },
        })

        if (!currentTournament) {
            this.getServer().emit('tournament-leaderboard', { leaderboard: [] })
            return
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

        const sortedLeaderboard = leaderboard.map(user => {
            const totalPoints = user.rounds.reduce((acc, round) => acc + round.point, 0)
            return {
                ...user,
                totalRounds: user.rounds.length,
                totalPoints,
                rounds: undefined,
            }
        })

        sortedLeaderboard.sort((a, b) => b.totalPoints - a.totalPoints)

        this.getServer().emit('tournament-leaderboard', { currentTournament, leaderboard: sortedLeaderboard })
    }
}