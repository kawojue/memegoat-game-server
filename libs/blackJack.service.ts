import { Injectable } from '@nestjs/common'
import { RandomService } from './random.service'
import { PrismaService } from 'prisma/prisma.service'

@Injectable()
export class BlackjackService {
    private decks: Map<string, Card[]> = new Map()

    constructor(
        private readonly prisma: PrismaService,
        private readonly randomService: RandomService,
    ) { }

    private initDeck(): Card[] {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades']
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
        return suits.flatMap(suit => values.map(value => ({ suit, value })))
    }

    private shuffleDeck(deck: Card[]): Card[] {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(this.randomService.randomize().random * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]]
        }
        return deck
    }

    private calculateScore(hand: Card[]): number {
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

        while (score > 21 && aces) {
            score -= 10
            aces -= 1
        }

        return score
    }

    async startGame(userId: string, stake: number) {
        let deck = this.initDeck()
        deck = this.shuffleDeck(deck)
        this.decks.set(userId, deck)

        const playerHand = [deck.pop(), deck.pop()]
        const dealerHand = [deck.pop()]

        const dealer = await this.prisma.dealer.create({
            data: {
                hand: dealerHand as any,
                score: this.calculateScore(dealerHand),
                stand: false,
            },
        })

        const game = await this.prisma.game.create({
            data: {
                status: 'started',
                dealerId: dealer.id,
                players: {
                    create: {
                        hand: playerHand as any,
                        user: { connect: { id: userId } },
                        score: this.calculateScore(playerHand),
                        stand: false,
                        stake,
                    },
                },
            },
            include: { dealer: true, players: true },
        })

        return game.id
    }

    async joinGame(gameId: string, userId: string) {
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true },
        })

        if (!game) throw new Error('Game not found')
        if (game.players.length >= 2) throw new Error('Game already full')

        const deck = this.decks.get(game.players[0].userId)
        if (!deck) throw new Error('Deck not found for game')

        const playerHand = [deck.pop(), deck.pop()]

        await this.prisma.game.update({
            where: { id: gameId },
            data: {
                players: {
                    create: {
                        userId,
                        hand: playerHand as any,
                        score: this.calculateScore(playerHand),
                        stand: false,
                    },
                },
            },
        })

        return true
    }

    async getGameState(gameId: string) {
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true, dealer: true },
        })

        return game
    }

    async hit(gameId: string, userId: string) {
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true, dealer: true },
        })

        const player = game.players.find(p => p.userId === userId)
        if (!player) throw new Error('Player not found in game')
        if (player.stand) throw new Error('Player has already stood')

        const deck = this.decks.get(game.players[0].userId)
        if (!deck) throw new Error('Deck not found for game')

        // @ts-ignore
        player.hand.push(deck.pop())

        // @ts-ignore
        const playerScore = this.calculateScore(player.hand)

        await this.prisma.player.update({
            where: { id: player.id },
            data: {
                hand: player.hand,
                score: playerScore,
            },
        })

        return player
    }

    async stand(gameId: string, userId: string) {
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true, dealer: true },
        })

        const player = game.players.find(p => p.userId === userId)
        if (!player) throw new Error('Player not found in game')
        if (player.stand) throw new Error('Player has already stood')

        player.stand = true

        await this.prisma.player.update({
            where: { id: player.id },
            data: { stand: player.stand },
        })

        return player
    }

    async dealerPlay(gameId: string) {
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true, dealer: true },
        })

        const dealer = game.dealer

        const deck = this.decks.get(game.players[0].userId)
        if (!deck) throw new Error('Deck not found for game')

        // @ts-ignore
        while (this.calculateScore(dealer.hand) < 17) {
            // @ts-ignore
            dealer.hand.push(deck.pop())
        }

        // @ts-ignore
        const dealerScore = this.calculateScore(dealer.hand)

        await this.prisma.dealer.update({
            where: { id: dealer.id },
            data: {
                hand: dealer.hand,
                score: dealerScore,
                stand: dealerScore >= 17,
            },
        })

        await this.prisma.game.update({
            where: { id: gameId },
            data: {
                status: 'finished',
                updatedAt: new Date(),
            },
        })

        return dealer
    }

    async leaveGame(gameId: string, userId: string) {
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true },
        })

        const player = game.players.find(p => p.userId === userId)
        if (!player) throw new Error('Player not found in game')

        await this.prisma.player.delete({
            where: { id: player.id },
        })

        if (game.players.length === 1) {
            await this.prisma.game.delete({ where: { id: gameId } })
        }
    }

    async handlePlayerDisconnection(userId: string) {
        const games = await this.prisma.game.findMany({
            where: {
                players: {
                    some: { userId },
                },
            },
            include: { players: true },
        })

        for (const game of games) {
            const player = game.players.find(p => p.userId === userId)

            if (player) {
                await this.leaveGame(game.id, userId)
            }
        }
    }

    async getPlayerGames(userId: string) {
        return this.prisma.game.findMany({
            where: {
                players: {
                    some: { userId },
                },
            },
            include: { players: true },
        })
    }

    async allPlayersStood(gameId: string): Promise<boolean> {
        const game = await this.prisma.game.findUnique({
            where: { id: gameId },
            include: { players: true },
        })

        if (!game) throw new Error('Game not found')

        return game.players.every(player => player.stand)
    }
}
