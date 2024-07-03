import { Response } from 'express'
import { Injectable } from '@nestjs/common'
import { StatusCodes } from 'enums/StatusCodes'
import { MiscService } from 'libs/misc.service'
import { RandomService } from 'libs/random.service'
import { AlgoType, DiceRound } from '@prisma/client'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { CreateDiceGameDTO, DiceRoundDTO } from './dto/dice.dto'

@Injectable()
export class DiceService {
    private readonly random: RandomService

    constructor(
        private readonly misc: MiscService,
        private readonly prisma: PrismaService,
        private readonly response: ResponseService,
    ) {
        this.random = new RandomService(AlgoType.sha256)
    }

    private rollDice(numDice: 1 | 2) {
        const results: {
            result: number
            seed: string
            algo_type: AlgoType,
        }[] = []

        for (let i = 0; i < numDice; i++) {
            const { algo_type, random, seed } = this.random.randomize()

            results.push({
                seed,
                algo_type,
                result: Math.floor(random * 6) + 1
            })
        }

        return results
    }

    private isRoundWon(round: { numDice: 1 | 2, guess: number[], result: { result: number }[] }): boolean {
        return round.guess.every((guess, index) => guess === round.result[index].result)
    }

    calculateOdds(roundsDto: DiceRoundDTO): number {
        const rounds = roundsDto.rounds
        let odds = 1

        rounds.forEach(round => {
            if (round.numDice === 1) {
                odds *= 6
            } else if (round.numDice === 2) {
                const uniqueGuesses = new Set(round.guess).size
                if (uniqueGuesses === 1) {
                    odds *= 36
                } else {
                    odds *= 18
                }
            }
        })

        return odds
    }


    async createGame(
        res: Response,
        { sub }: ExpressUser,
        { rounds, stake }: CreateDiceGameDTO
    ) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: sub }
            })

            // TODO: Check wallet balance

            const odds = this.calculateOdds({ rounds })

            const initRounds = rounds.map(round => {
                const result = this.rollDice(round.numDice as 1 | 2)
                return {
                    numDice: round.numDice as 1 | 2,
                    guess: round.guess,
                    result,
                    createdAt: new Date(),
                }
            })

            const isLost = initRounds.some(round => !this.isRoundWon(round))

            const game = await this.prisma.game.create({
                data: {
                    stake: stake,
                    totalOdds: odds,
                    game_type: 'dice',
                    user: { connect: { id: sub } },
                    winAmount: isLost ? 0 : stake * odds,
                }
            })

            let newRounds: DiceRound[] = []

            if (game) {
                newRounds = await Promise.all(initRounds.map(async (round) => {
                    const eachRound = await this.prisma.diceRound.create({
                        data: {
                            game: { connect: { id: game.id } },
                            createdAt: round.createdAt,
                            numDice: round.numDice,
                            guess: round.guess,
                            results: {
                                createMany: { data: round.result }
                            }
                        },
                        include: { results: true }
                    })

                    return eachRound as DiceRound // Ensure it matches the type
                }))
            }

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

            // TODO: Credit user's wallet if they win - winAmount

            this.response.sendSuccess(res, StatusCodes.OK, { data: { game, rounds: newRounds } })
        } catch (err) {
            this.misc.handleServerError(res, err)
        }
    }
}