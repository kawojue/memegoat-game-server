import { Response } from 'express'
import { Injectable } from '@nestjs/common'
import { StatusCodes } from 'enums/StatusCodes'
import { MiscService } from 'libs/misc.service'
import { FlipperService } from './flipper.service'
import { CreateCoinGameDTO } from './dto/coin.dto'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { AlgoType, CoinFlipRound } from '@prisma/client'

@Injectable()
export class CoinFlipService {
    private readonly flipper: FlipperService

    constructor(
        private readonly misc: MiscService,
        private readonly prisma: PrismaService,
        private readonly response: ResponseService,
    ) {
        this.flipper = new FlipperService(AlgoType.sha256)
    }

    calculateOdds(guesses: ('heads' | 'tails')[]): number {
        const numRounds = guesses.length
        const uniqueGuesses = new Set(guesses).size

        if (uniqueGuesses === 1) {
            return Math.pow(1.5, numRounds)
        } else {
            return numRounds + 0.5
        }
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
                const { result, seed, algo_type } = this.flipper.flipCoin()
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
                },
            })

            let newRounds: CoinFlipRound[] = []

            if (game) {
                for (const round of initRounds) {
                    const newRound = await this.prisma.coinFlipRound.create({
                        data: { ...round, game: { connect: { id: game.id } } }
                    })

                    newRounds.push(newRound)
                }
            }

            res.on('finish', async () => {
                await this.prisma.stat.upsert({
                    where: { userId: sub },
                    update: {
                        total_wins: isLost ? { increment: 0 } : { increment: 1 },
                        total_losses: isLost ? { increment: 1 } : { increment: 0 },
                        total_earning: isLost ? { increment: 0 } : { increment: game.winAmount }
                    },
                    create: {
                        user: { connect: { id: sub } },
                        total_wins: isLost ? 0 : 1,
                        total_losses: isLost ? 1 : 0,
                        total_earning: isLost ? 0 : game.winAmount
                    }
                })
            })

            this.response.sendSuccess(res, StatusCodes.OK, { data: { game, rounds: newRounds } })
        } catch (err) {
            this.misc.handleServerError(res, err)
        }
    }
}
