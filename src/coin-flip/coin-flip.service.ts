import { Response } from 'express'
import { AlgoType } from '@prisma/client'
import { Injectable } from '@nestjs/common'
import { StatusCodes } from 'enums/StatusCodes'
import { MiscService } from 'libs/misc.service'
import { CreateCoinGameDTO } from './dto/coin.dto'
import { RandomService } from 'libs/random.service'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'

@Injectable()
export class CoinFlipService {
    private readonly flipper: RandomService

    constructor(
        private readonly misc: MiscService,
        private readonly prisma: PrismaService,
        private readonly response: ResponseService,
    ) {
        this.flipper = new RandomService(AlgoType.sha256)
    }

    calculateOdds(guesses: { heads: number; tails: number }): number {
        const totalGuesses = guesses.heads + guesses.tails
        let odds = Math.pow(1.5, totalGuesses)

        if (guesses.heads > 1) {
            odds += (guesses.heads - 1) * 0.5
        }
        if (guesses.tails > 1) {
            odds += (guesses.tails - 1) * 0.5
        }

        return odds
    }

    async createGame(
        res: Response,
        { sub }: ExpressUser,
        { heads, tails, stake }: CreateCoinGameDTO,
    ) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: sub }
            })

            // TODO: Check wallet balance here to see if the stake amount is not greater than their balance

            const guesses = { heads, tails }
            const odds = this.calculateOdds(guesses)

            const initRounds = []
            for (let i = 0; i < heads + tails; i++) {
                const { result, seed, algo_type } = this.flipper.randomize()
                initRounds.push({
                    seed,
                    result,
                    algo_type,
                    guess: i < heads ? 'heads' : 'tails',
                    createdAt: new Date(),
                })
            }

            const isLost = initRounds.some(round => round.guess !== round.result)

            const game = await this.prisma.game.create({
                data: {
                    stake: stake,
                    totalOdds: odds,
                    game_type: 'coin_flipper',
                    user: { connect: { id: sub } },
                    winAmount: isLost ? 0 : stake * odds,
                    coin_flip_rounds: {
                        createMany: {
                            data: initRounds
                        }
                    }
                },
                include: {
                    coin_flip_rounds: true,
                }
            })

            // TODO: Credit user's wallet if they win - winAmount

            res.on('finish', async () => {
                await this.prisma.stat.upsert({
                    where: { userId: sub },
                    update: {
                        total_wins: isLost ? { increment: 0 } : { increment: 1 },
                        total_losses: isLost ? { increment: 1 } : { increment: 0 },
                        total_earnings: isLost ? { increment: 0 } : { increment: game.winAmount }
                    },
                    create: {
                        user: { connect: { id: sub } },
                        total_wins: isLost ? 0 : 1,
                        total_losses: isLost ? 1 : 0,
                        total_earnings: isLost ? 0 : game.winAmount
                    }
                })
            })

            this.response.sendSuccess(res, StatusCodes.OK, { data: game })
        } catch (err) {
            this.misc.handleServerError(res, err)
        }
    }
}
