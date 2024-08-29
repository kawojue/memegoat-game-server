import {
    Process,
    Processor,
    OnQueueActive,
    OnQueueFailed,
    OnQueueCompleted,
} from '@nestjs/bull'
import {
    BetStatus,
    SportbetOutcome,
} from '@prisma/client'
import { Job } from 'bull'
import { ApiService } from 'libs/api.service'
import { PrismaService } from 'prisma/prisma.service'

@Processor('sports-queue')
export class SportsQueueProcessor {
    constructor(
        private readonly api: ApiService,
        private readonly prisma: PrismaService,
    ) { }

    @Process('cron.sport')
    async sportsQueueJob({ data }: Job<{ batchIds: string }>) {
        const res = await this.api.apiSportGET<any>(`/fixtures?ids=${data.batchIds}`)
        const fixtures = res.response as FootballMatchResponse[]

        await Promise.all(fixtures.map(async (fixture) => {
            const bets = await this.prisma.sportBet.findMany({
                where: { fixureId: fixture.fixture.id.toString() }
            })

            for (const bet of bets) {
                let outcome: SportbetOutcome = SportbetOutcome.NOT_DECIDED

                let status: BetStatus = BetStatus.ONGOING

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
                        elapsed: fixture.fixture.status.elapsed.toString(),
                    },
                    include: {
                        sportRound: true,
                    }
                })

                if (outcome === SportbetOutcome.WIN) {
                    await this.prisma.sportRound.update({
                        where: { betId: bet.id },
                        data: { point: bet.potentialWin },
                    })

                    await this.prisma.stat.update({
                        where: { userId: bet.userId },
                        data: {
                            total_points: { increment: bet.potentialWin },
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
                }
                console.log(bet)
            }
        }))
    }

    @OnQueueActive()
    onActive(job: Job) {
        console.info(
            `(Queue) Processing: job ${job.id} of ${job.queue.name} with data: ${JSON.stringify(job.data)}...`
        )
    }

    @OnQueueCompleted()
    async OnQueueCompleted(job: Job) {
        console.info(
            '(Queue) Completed: job ',
            job.id,
            job.queue.name,
        )
    }

    @OnQueueFailed()
    OnQueueFailed(job: Job, error: Error) {
        console.info(
            '(Queue) Error on: job ',
            job.id,
            ' -> error: ',
            error.message,
        )
    }
}