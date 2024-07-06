import {
    BetType, Color, OddEven,
    CreateRouletteGameDTO, Bet,
} from './dto/roulette.dto'
import { Response } from 'express'
import { AlgoType } from '@prisma/client'
import { Injectable } from '@nestjs/common'
import { StatusCodes } from 'enums/StatusCodes'
import { MiscService } from 'libs/misc.service'
import { RandomService } from 'libs/random.service'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'

@Injectable()
export class RouletteService {
    private readonly random: RandomService

    constructor(
        private readonly misc: MiscService,
        private readonly prisma: PrismaService,
        private readonly response: ResponseService,
    ) {
        this.random = new RandomService(AlgoType.sha256)
    }

    private spinWheel(): number {
        return Math.floor(this.random.randomize().random * 37) // 0-36
    }

    private determineWinningColor(number: number): Color | null {
        if (number === 0) return null
        const redNumbers = [
            1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
        ]
        return redNumbers.includes(number) ? Color.Red : Color.Black
    }

    private determineWinningOddEven(number: number): OddEven | null {
        if (number === 0) return null
        return number % 2 === 0 ? OddEven.Even : OddEven.Odd
    }

    private calculatePayout(bet: Bet, winningNumber: number): number {
        switch (bet.type) {
            case BetType.Single:
                return bet.number === winningNumber ? 35 : 0
            case BetType.Range:
                return bet.range.includes(winningNumber) ? (36 / bet.range.length) - 1 : 0
            case BetType.Color:
                return bet.color === this.determineWinningColor(winningNumber) ? 1 : 0
            case BetType.OddEven:
                return bet.oddEven === this.determineWinningOddEven(winningNumber) ? 1 : 0
            default:
                return 0
        }
    }

    private calculateTotalPayout(bets: Bet[], winningNumber: number): number {
        return bets.reduce((total, bet) => total + this.calculatePayout(bet, winningNumber), 0)
    }

    calculateOdds(bets: Bet[]): number {
        let odds = 0

        bets.forEach(bet => {
            switch (bet.type) {
                case BetType.Single:
                    odds += 35
                    break
                case BetType.Range:
                    odds += (36 / bet.range.length) - 1
                    break
                case BetType.Color:
                    odds += 1
                    break
                case BetType.OddEven:
                    odds += 1
                    break
                default:
                    break
            }
        })

        return odds
    }

    async createGame(
        res: Response,
        { sub }: ExpressUser,
        { bets, stake }: CreateRouletteGameDTO
    ) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: sub }
            })

            // TODO: Check wallet balance

            const winningNumber = this.spinWheel()
            const totalPayout = this.calculateTotalPayout(bets, winningNumber)
            const winAmount = stake * totalPayout

            const game = await this.prisma.game.create({
                data: {
                    stake: stake,
                    totalOdds: totalPayout,
                    game_type: 'roulette',
                    user: { connect: { id: sub } },
                    winAmount: winAmount,
                }
            })

            res.on('finish', async () => {
                await this.prisma.stat.upsert({
                    where: { userId: sub },
                    update: {
                        total_wins: totalPayout > 0 ? { increment: 1 } : { increment: 0 },
                        total_losses: totalPayout === 0 ? { increment: 1 } : { increment: 0 },
                        total_earnings: totalPayout > 0 ? { increment: winAmount } : { increment: 0 }
                    },
                    create: {
                        user: { connect: { id: sub } },
                        total_wins: totalPayout > 0 ? 1 : 0,
                        total_losses: totalPayout === 0 ? 1 : 0,
                        total_earnings: totalPayout > 0 ? winAmount : 0
                    }
                })
            })

            // TODO: Credit user's wallet if they win - winAmount

            this.response.sendSuccess(res, StatusCodes.OK, { data: { game, winningNumber } })
        } catch (err) {
            this.misc.handleServerError(res, err)
        }
    }
}
