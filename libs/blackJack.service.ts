import { Injectable } from '@nestjs/common'
import { Dealer, Player } from '@prisma/client'
import { RandomService } from './random.service'
import { PrismaService } from 'prisma/prisma.service'

@Injectable()
export class BlackjackService {
    private decks: Card[] = []
    private randomService: RandomService

    constructor(private readonly prisma: PrismaService) {
        this.initDeck()
        this.randomService = new RandomService('sha256')
    }

    private initDeck() {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades']
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
        this.decks = suits.flatMap(suit => values.map(value => ({ suit, value })))
    }

    private shuffleDeck() {
        for (let i = this.decks.length - 1; i > 0; i--) {
            const j = Math.floor(this.randomService.randomize().random * (i + 1));
            [this.decks[i], this.decks[j]] = [this.decks[j], this.decks[i]]
        }
    }

    private calculateScore(hand: any): number {
        let score = 0
        let aces = 0

        hand.forEach(card => {
            if (card.value === 'A') {
                aces += 1
                score += 11
            } else if (['J', 'Q', 'K'].includes(card.value)) {
                score += 10
            } else {
                score += parseInt(card.value, 10)
            }
        })

        while (score > 21 && aces > 0) {
            score -= 10
            aces -= 1
        }

        return score
    }

    async startGame(playerId: string): Promise<string> {
        const gameId = playerId + '-' + new Date().getTime()
        this.shuffleDeck()

        const dealer = await this.prisma.dealer.create({
            data: {
                hand: [],
                score: 0,
            },
        })

        const player = await this.prisma.player.create({
            data: {
                user: { connect: { id: playerId } },
                hand: [],
                score: 0,
                stand: false,
                game: { connect: { id: gameId } },
            },
        })

        // @ts-ignore
        dealer.hand.push(this.decks.pop(), this.decks.pop())
        // @ts-ignore
        player.hand.push(this.decks.pop(), this.decks.pop())

        dealer.score = this.calculateScore(dealer.hand)
        player.score = this.calculateScore(player.hand)

        await this.prisma.dealer.update({
            where: { id: dealer.id },
            data: {
                hand: dealer.hand,
                score: dealer.score,
            },
        })

        await this.prisma.player.update({
            where: { id: player.id },
            data: {
                hand: player.hand,
                score: player.score,
            },
        })

        await this.prisma.game.create({
            data: {
                id: gameId,
                status: 'ongoing',
                dealerId: dealer.id,
                players: {
                    connect: { id: player.id },
                },
            },
        })

        return gameId
    }

    async joinGame(gameId: string, playerId: string): Promise<boolean> {
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true },
        })

        if (game) {
            const player = await this.prisma.player.create({
                data: {
                    userId: playerId,
                    hand: [],
                    score: 0,
                    stand: false,
                    gameId: gameId,
                },
            })

            // @ts-ignore
            player.hand.push(this.decks.pop(), this.decks.pop())
            player.score = this.calculateScore(player.hand)

            await this.prisma.player.update({
                where: { id: player.id },
                data: {
                    hand: player.hand,
                    score: player.score,
                },
            })

            return true
        }
        return false
    }

    async placeBet(gameId: string, playerId: string, bet: number): Promise<boolean> {
        const player = await this.prisma.player.findFirst({
            where: { gameId, userId: playerId },
        })

        if (!player) return false

        await this.prisma.player.update({
            where: { id: player.id },
            data: { bet },
        })

        return true
    }

    async hit(gameId: string, playerId: string): Promise<Player | null> {
        const player = await this.prisma.player.findFirst({
            where: { gameId, userId: playerId },
        })

        if (!player || player.stand) return null

        // @ts-ignore
        player.hand.push(this.decks.pop())
        player.score = this.calculateScore(player.hand)

        if (player.score > 21) {
            player.stand = true
        }

        await this.prisma.player.update({
            where: { id: player.id },
            data: {
                hand: player.hand,
                score: player.score,
                stand: player.stand,
            },
        })

        return player
    }

    async stand(gameId: string, playerId: string): Promise<Player | null> {
        const player = await this.prisma.player.findFirst({
            where: { gameId, userId: playerId },
        })

        if (!player) return null

        player.stand = true

        await this.prisma.player.update({
            where: { id: player.id },
            data: { stand: true },
        })

        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true },
        })

        const allPlayersStand = game.players.every(p => p.stand)
        if (allPlayersStand) {
            await this.dealerPlay(gameId)
        }

        return player
    }

    async leaveGame(gameId: string, playerId: string): Promise<boolean> {
        const player = await this.prisma.player.findFirst({
            where: { gameId, userId: playerId },
        })

        if (!player) return false

        await this.prisma.player.delete({
            where: { id: player.id },
        })

        return true
    }

    async dealerPlay(gameId: string) {
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            include: { dealer: true },
        })

        const dealer = game.dealer

        while (dealer.score < 17) {
            // @ts-ignore
            dealer.hand.push(this.decks.pop())
            dealer.score = this.calculateScore(dealer.hand)
        }
        dealer.stand = true

        await this.prisma.dealer.update({
            where: { id: dealer.id },
            data: {
                hand: dealer.hand,
                score: dealer.score,
                stand: true,
            },
        })

        await this.endGame(gameId)
    }

    private async endGame(gameId: string) {
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            include: { dealer: true, players: true },
        })

        if (!game) return

        const dealerScore = game.dealer.score
        for (const player of game.players) {
            let result: string

            if (player.score > 21) {
                result = 'Bust'
            } else if (dealerScore > 21 || player.score > dealerScore) {
                result = 'Win'
            } else if (player.score < dealerScore) {
                result = 'Lose'
            } else {
                result = 'Push'
            }

            await this.prisma.player.update({
                where: { id: player.id },
                data: { result },
            })
        }

        await this.prisma.game.update({
            where: { id: game.id },
            data: { status: 'completed' },
        })
    }

    async getGameState(gameId: string): Promise<{ dealer: Dealer; players: Player[] }> {
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            include: { dealer: true, players: true },
        })

        return {
            dealer: game.dealer,
            players: game.players,
        }
    }
}
