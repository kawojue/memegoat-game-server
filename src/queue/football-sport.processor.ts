import {
    Processor,
    WorkerHost,
} from '@nestjs/bullmq'
import {
    BetStatus,
    SportbetOutcome,
} from '@prisma/client'
import { Job } from 'bullmq'
import { ApiService } from 'libs/api.service'
import { PrismaService } from 'prisma/prisma.service'

@Processor('sports-football-queue')
export class FootballSportsQueueProcessor extends WorkerHost {

    constructor(
        private readonly api: ApiService,
        private readonly prisma: PrismaService,
    ) {
        super()
    }

    async process({ data: { batchIds } }: Job<{ batchIds: string }>) {
        const res = await this.api.apiSportGET<any>(`/fixtures?ids=${batchIds}`)
        const fixtures = res.response as FootballMatchResponse[]

        await Promise.all(fixtures.map(async (fixture) => {
            const bets = await this.prisma.sportBet.findMany({
                where: { fixureId: String(fixture.fixture.id) }
            })

            for (const bet of bets) {
                let outcome: SportbetOutcome = SportbetOutcome.NOT_DECIDED

                const elapsed = fixture.fixture.status?.elapsed
                let status: BetStatus = elapsed !== null ? BetStatus.ONGOING : BetStatus.NOT_STARTED

                if (
                    fixture.fixture.status.short === 'FT' ||
                    fixture.fixture.status.short === 'AET' ||
                    fixture.fixture.status.short === 'PEN'
                ) {
                    const homeWin = fixture.teams.home.winner
                    const awayWin = fixture.teams.away.winner

                    if (bet.placebetOutcome === 'home' && homeWin) {
                        outcome = SportbetOutcome.WIN
                    } else if (bet.placebetOutcome === 'away' && awayWin) {
                        outcome = SportbetOutcome.WIN
                    } else if (bet.placebetOutcome === 'draw' && homeWin === awayWin) {
                        outcome = SportbetOutcome.WIN
                    } else {
                        outcome = SportbetOutcome.LOSE
                    }

                    status = BetStatus.FINISHED
                } else if (
                    fixture.fixture.status.short === 'CANC' ||
                    fixture.fixture.status.short === 'SUSP'
                ) {
                    status = BetStatus.FINISHED
                    outcome = SportbetOutcome.CANCELLED
                }

                await this.prisma.sportBet.update({
                    where: { id: bet.id },
                    data: {
                        outcome, status,
                        goals: {
                            home: fixture.goals.home,
                            away: fixture.goals.away,
                        },
                        elapsed: elapsed === null ? null : String(elapsed)
                    },
                })

                if (outcome === SportbetOutcome.WIN) {
                    await this.prisma.sportRound.update({
                        where: { betId: bet.id },
                        data: { point: bet.potentialWin },
                    })

                    await this.prisma.stat.update({
                        where: { userId: bet.userId },
                        data: {
                            total_sport_wins: { increment: 1 },
                            total_sport_points: { increment: bet.potentialWin },
                        },
                    })
                }

                if (outcome === SportbetOutcome.LOSE) {
                    await this.prisma.stat.update({
                        where: { userId: bet.userId },
                        data: {
                            total_sport_losses: { increment: 1 }
                        },
                    })
                }

                if (outcome === SportbetOutcome.CANCELLED) {
                    await this.prisma.stat.update({
                        where: { userId: bet.userId },
                        data: {
                            tickets: { increment: bet.stake },
                        },
                    })

                    await this.prisma.sportTournament.updateMany({
                        where: {
                            paused: false,
                            start: { lte: new Date(new Date().toUTCString()) },
                            end: { gte: new Date(new Date().toUTCString()) },
                        },
                        data: {
                            totalStakes: { decrement: bet.stake }
                        }
                    })
                }
            }
        }))
    }
}