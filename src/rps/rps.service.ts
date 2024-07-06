import { Response } from 'express'
import { AlgoType } from '@prisma/client'
import { Injectable } from '@nestjs/common'
import { StatusCodes } from 'enums/StatusCodes'
import { MiscService } from 'libs/misc.service'
import { RandomService } from 'libs/random.service'
import { PrismaService } from 'prisma/prisma.service'
import { CreateRPSGameDTO, Move } from './dto/rps.dto'
import { ResponseService } from 'libs/response.service'

@Injectable()
export class RPSService {
    private readonly random: RandomService

    constructor(
        private readonly misc: MiscService,
        private readonly prisma: PrismaService,
        private readonly response: ResponseService,
    ) {
        this.random = new RandomService(AlgoType.sha256)
    }

    private getComputerMove(): Move {
        const moves = [Move.Rock, Move.Paper, Move.Scissors]
        const randomIndex = Math.floor(this.random.randomize().random * moves.length)
        return moves[randomIndex]
    }

    private determineWinner(playerMove: Move, computerMove: Move): string {
        if (playerMove === computerMove) return 'draw'
        if (
            (playerMove === Move.Rock && computerMove === Move.Scissors) ||
            (playerMove === Move.Paper && computerMove === Move.Rock) ||
            (playerMove === Move.Scissors && computerMove === Move.Paper)
        ) {
            return 'player'
        }
        return 'computer'
    }

    private calculateOdds(winner: string): number {
        if (winner === 'draw') return 1
        return 2
    }

    async createGame(
        res: Response,
        { sub }: ExpressUser,
        { playerMove, stake }: CreateRPSGameDTO
    ) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: sub }
            })

            // TODO: Check wallet balance

            const computerMove = this.getComputerMove()
            const winner = this.determineWinner(playerMove, computerMove)
            const odds = this.calculateOdds(winner)
            const winAmount = winner === 'player' ? stake * odds : 0

            const game = await this.prisma.game.create({
                data: {
                    stake: stake,
                    totalOdds: odds,
                    game_type: 'rock_paper_scissors',
                    user: { connect: { id: sub } },
                    winAmount: winAmount,
                }
            })

            res.on('finish', async () => {
                await this.prisma.stat.upsert({
                    where: { userId: sub },
                    update: {
                        total_wins: winner === 'player' ? { increment: 1 } : { increment: 0 },
                        total_losses: winner === 'computer' ? { increment: 1 } : { increment: 0 },
                        total_earnings: winner === 'player' ? { increment: winAmount } : { increment: 0 }
                    },
                    create: {
                        user: { connect: { id: sub } },
                        total_wins: winner === 'player' ? 1 : 0,
                        total_losses: winner === 'computer' ? 1 : 0,
                        total_earnings: winner === 'player' ? winAmount : 0
                    }
                })
            })

            // TODO: Credit user's wallet if they win - winAmount

            this.response.sendSuccess(res, StatusCodes.OK, { data: { game, computerMove, winner } })
        } catch (err) {
            this.misc.handleServerError(res, err)
        }
    }
}
