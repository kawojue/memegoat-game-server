import { Response } from 'express'
import { AlgoType } from '@prisma/client'
import { StatusCodes } from 'enums/StatusCodes'
import { MiscService } from 'libs/misc.service'
import { CreateDiceGameDTO } from './dto/dice.dto'
import { RandomService } from 'libs/random.service'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { BadRequestException, Injectable } from '@nestjs/common'

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

    private rollDice(size: 1 | 2) {
        const results: {
            result: number
            seed: string
            algo_type: AlgoType,
        }[] = []

        for (let i = 0; i < size; i++) {
            const { algo_type, random, seed } = this.random.randomize()

            results.push({
                seed,
                algo_type,
                result: Math.floor(random * 6) + 1
            })
        }

        return results
    }

    private isRoundWon(size: 1 | 2, guesses: number[], results: { result: number }[]): boolean {
        return guesses.every((guess, index) => guess === results[index].result)
    }

    private isNotValidRound(size: 1 | 2, guesses: number[]): boolean {
        return size !== guesses.length
    }

    calculateOdds(size: 1 | 2, guesses: number[]): number {
        if (this.isNotValidRound(size, guesses)) {
            throw new BadRequestException("Invalid guess or dice number")
        }

        let odds = 1
        if (size === 1) {
            odds *= 2.5
        } else if (size === 2) {
            const uniqueGuesses = new Set(guesses).size
            if (uniqueGuesses === 1) {
                odds *= 4
            } else {
                odds *= 3
            }
        }

        return odds
    }

    async createGame(
        res: Response,
        { sub }: ExpressUser,
        { size, guesses, stake }: CreateDiceGameDTO
    ) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: sub }
            })

            // TODO: Check wallet balance

            if (this.isNotValidRound(size, guesses)) {
                return this.response.sendError(res, StatusCodes.BadRequest, "Invalid guess or dice number")
            }

            const odds = this.calculateOdds(size, guesses)

            const results = this.rollDice(size)
            const isLost = !this.isRoundWon(size, guesses, results)

            const game = await this.prisma.game.create({
                data: {
                    stake: stake,
                    totalOdds: odds,
                    game_type: 'dice',
                    user: { connect: { id: sub } },
                    winAmount: isLost ? 0 : stake * odds,
                }
            })

            const round = await this.prisma.diceRound.create({
                data: {
                    game: { connect: { id: game.id } },
                    createdAt: new Date(),
                    numDice: size,
                    guess: guesses,
                    results: {
                        createMany: { data: results }
                    }
                },
                include: { results: true }
            })

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

            this.response.sendSuccess(res, StatusCodes.OK, { data: { game, round } })
        } catch (err) {
            this.misc.handleServerError(res, err)
        }
    }
}
