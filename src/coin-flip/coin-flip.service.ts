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

    calculateOdds(guesses: ('heads' | 'tails')[]): number {
        const numRounds = guesses.length
        const counts = { heads: 0, tails: 0 }

        guesses.forEach(guess => {
            counts[guess]++
        })

        const uniqueGuesses = new Set(guesses).size

        let odds = uniqueGuesses === 1 ? Math.pow(1.5, numRounds) : numRounds + 0.5

        for (const count of Object.values(counts)) {
            if (count > 1) {
                odds += (count - 1) * 0.5
            }
        }

        return odds
    }

    async createGame(
        res: Response,
        { sub }: ExpressUser,
        { rounds, stake }: CreateCoinGameDTO,
    ) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: sub }
            })

            //TODO: Gonna check wallet balance here to see if the stake amount is not greater than their balance

            const odds = this.calculateOdds(rounds.map(round => round.guess))

            const initRounds = rounds.map(round => {
                const { result, seed, algo_type } = this.flipper.randomize()
                return {
                    seed,
                    result,
                    algo_type,
                    guess: round.guess,
                    createdAt: new Date(),
                }
            })

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

            // TODO: credit user's wallet if he/she wins - winAmount

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
