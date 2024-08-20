import {
  DiceDTO,
  GameIdDTO,
  CoinFlipDTO,
  RouletteDTO,
  SelectBoxDTO,
  StartBlindBoxGameDTO,
} from './dto/index.dto'
import {
  MessageBody,
  OnGatewayInit,
  ConnectedSocket,
  WebSocketServer,
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { JwtService } from '@nestjs/jwt'
import { GameType } from '@prisma/client'
import { Server, Socket } from 'socket.io'
import { StatusCodes } from 'enums/StatusCodes'
import { RandomService } from 'libs/random.service'
import { RealtimeService } from './realtime.service'
import { PrismaService } from 'prisma/prisma.service'
import { BlackjackService } from 'libs/blackJack.service'

@WebSocketGateway({
  transports: ['polling', 'websocket'],
  cors: {
    origin: [
      'http://localhost:3000',
      'https://games.memegoat.io',
      'https://memegoat-games.vercel.app',
      'https://memegoat-game-server.onrender.com',
    ],
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer() server: Server

  constructor(
    private readonly prisma: PrismaService,
    private readonly random: RandomService,
    private readonly jwtService: JwtService,
    private readonly realtimeService: RealtimeService,
    private readonly blackjackService: BlackjackService,
  ) { }

  private clients: Map<Socket, JwtPayload> = new Map()
  private onlineUsers: Map<string, string> = new Map()
  private games: Map<string, { board: string[][]; points: number }> = new Map()

  afterInit() {
    this.realtimeService.setServer(this.server)
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.headers['authorization']?.split('Bearer ')[1]

    if (token) {
      try {
        const { sub, address } = await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_SECRET,
          ignoreExpiration: false,
        }) as JwtPayload

        const { active } = await this.prisma.user.findUnique({
          where: { id: sub },
          select: { active: true },
        })

        if (!active) {
          client.emit('error', {
            status: StatusCodes.Forbidden,
            message: 'Account Suspended',
          })
          client.disconnect()
          return
        }

        this.clients.set(client, { sub, address })
        this.onlineUsers.set(sub, client.id)
        this.emitOnlineUserCount()

      } catch (err) {
        client.emit('error', {
          status: StatusCodes.InternalServerError,
          message: err.message,
        })
        client.disconnect()
      }
    }

    client.emit('connected', { message: 'Connected' })
  }

  handleDisconnect(client: Socket) {
    const user = this.clients.get(client)
    if (user) {
      this.onlineUsers.delete(user.sub)
      this.emitOnlineUserCount()
    }
    this.clients.delete(client)
  }

  private emitOnlineUserCount() {
    const onlineUserCount = this.onlineUsers.size
    this.server.emit('online-user-count', { data: onlineUserCount })
  }

  @SubscribeMessage('coin-flip')
  async handleCoinFlip(
    @ConnectedSocket() client: Socket,
    @MessageBody() { guess, stake }: CoinFlipDTO,
  ) {
    if (guess !== 'heads' && guess !== 'tails') {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: 'Coin face is either heads or tails',
      })
      client.disconnect()
      return
    }

    const user = this.clients.get(client)
    if (!user) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'User not connected',
      })
      client.disconnect()
      return
    }

    const { sub } = user

    const stat = await this.prisma.stat.findUnique({
      where: { userId: sub },
    })

    if (stat.tickets < stake) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'Out of ticket. Buy more tickets',
      })
      client.disconnect()
      return
    }

    const { random } = this.random.randomize()
    const outcome = random < 0.5 ? 'heads' : 'tails'

    const win = outcome === guess
    const point = win ? stake * 2 : 0
    const updateData = win ? { total_wins: { increment: 1 }, total_points: { increment: point } } : { total_losses: { increment: 1 } }

    const round = {
      game_type: 'CoinFlip' as GameType,
      point: point,
    }

    client.emit('coin-flip-result', { ...round, win, outcome, stake })

    await this.prisma.$transaction([
      this.prisma.round.create({
        data: {
          ...round,
          user: { connect: { id: sub } },
        },
      }),
      this.prisma.stat.update({
        where: { userId: sub },
        data: {
          tickets: { decrement: stake },
          ...updateData,
        },
      }),
    ])

    await this.realtimeService.leaderboard()
  }

  @SubscribeMessage('dice-roll')
  async handleDiceRoll(
    @ConnectedSocket() client: Socket,
    @MessageBody() { numDice, guesses, stake }: DiceDTO,
  ) {
    if (numDice < 1 || numDice > 5) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: 'Number of dice must be between 1 and 5',
      })
      client.disconnect()
      return
    }

    if (guesses.length !== numDice || !guesses.every((guess) => guess >= 1 && guess <= 6)) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: 'Invalid guesses for the number of dice',
      })
      client.disconnect()
      return
    }

    const user = this.clients.get(client)
    if (!user) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'User not connected',
      })
      client.disconnect()
      return
    }

    const { sub } = user

    const stat = await this.prisma.stat.findUnique({
      where: { userId: sub },
    })

    if (stat.tickets < stake) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'Out of ticket. Buy more tickets',
      })
      client.disconnect()
      return
    }

    const rolls = Array.from({ length: numDice }, () => Math.floor(this.random.randomize().random * 6) + 1)

    const win = rolls.every((roll, index) => roll === guesses[index])
    const point = win ? stake * numDice * 2 : 0
    const updateData = win ? { total_wins: { increment: 1 }, total_points: { increment: point } } : { total_losses: { increment: 1 } }

    const round = {
      game_type: 'Dice' as GameType,
      point: point,
    }

    client.emit('dice-roll-result', { ...round, win, rolls, stake })

    await this.prisma.$transaction([
      this.prisma.round.create({
        data: {
          ...round,
          user: { connect: { id: sub } },
        },
      }),
      this.prisma.stat.update({
        where: { userId: sub },
        data: {
          tickets: { decrement: stake },
          ...updateData
        },
      }),
    ])

    await this.realtimeService.leaderboard()
  }

  @SubscribeMessage('roulette-spin')
  async handleRouletteSpin(
    @ConnectedSocket() client: Socket,
    @MessageBody() { betType, number, stake }: RouletteDTO,
  ) {
    if (!['number', 'color', 'parity'].includes(betType)) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: 'Invalid bet type',
      })
      client.disconnect()
      return
    }

    if (betType === 'number' && (number < 0 || number > 36)) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: 'Number must be between 0 and 36',
      })
      client.disconnect()
      return
    }

    const user = this.clients.get(client)
    if (!user) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'User not connected',
      })
      client.disconnect()
      return
    }

    const { sub } = user

    const stat = await this.prisma.stat.findUnique({
      where: { userId: sub },
    })

    if (stat.tickets < stake) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'Out of tickets. Buy more tickets',
      })
      client.disconnect()
      return
    }

    const outcome = Math.floor(this.random.randomize().random * 37)
    const outcomeColor = outcome === 0 ? 'green' : outcome % 2 === 0 ? 'red' : 'black'
    const outcomeParity = outcome === 0 ? 'neither' : outcome % 2 === 0 ? 'even' : 'odd'

    const win =
      (betType === 'number' && number === outcome) ||
      (betType === 'color' && number === (outcomeColor === 'red' ? 1 : outcomeColor === 'black' ? 2 : 0)) ||
      (betType === 'parity' && number === (outcomeParity === 'even' ? 1 : outcomeParity === 'odd' ? 2 : 0))

    const point = win ? stake * 35 : 0
    const updateData = win ? { total_wins: { increment: 1 }, total_points: { increment: point } } : { total_losses: { increment: 1 } }

    const round = {
      game_type: 'Roulette' as GameType,
      point: point,
    }

    client.emit('roulette-spin-result', { ...round, win, outcome, stake })

    await this.prisma.$transaction([
      this.prisma.round.create({
        data: {
          ...round,
          user: { connect: { id: sub } },
        },
      }),
      this.prisma.stat.update({
        where: { userId: sub },
        data: {
          tickets: { decrement: stake },
          ...updateData
        },
      }),
    ])

    await this.realtimeService.leaderboard()
  }

  @SubscribeMessage('start-blackjack')
  async handleStartBlackjack(@ConnectedSocket() client: Socket, @MessageBody() { stake }: { stake: number }) {
    const user = this.clients.get(client)
    if (!user) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'User not authenticated',
      })
      return
    }

    try {
      const gameId = await this.blackjackService.startGame(user.sub, stake)
      client.emit('blackjack-started', { gameId, player: user.sub })
      await this.realtimeService.leaderboard()
    } catch (error) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: error.message,
      })
    }
  }

  @SubscribeMessage('join-blackjack')
  async handleJoinBlackjack(@MessageBody() data: GameIdDTO, @ConnectedSocket() client: Socket) {
    const user = this.clients.get(client)
    if (!user) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'User not authenticated',
      })
      return
    }

    try {
      await this.blackjackService.joinGame(data.gameId, user.sub)
      client.emit('blackjack-joined', { gameId: data.gameId, player: user.sub })
      await this.realtimeService.leaderboard()
    } catch (error) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: error.message,
      })
    }
  }

  @SubscribeMessage('hit-blackjack')
  async handleHitBlackjack(@MessageBody() data: GameIdDTO, @ConnectedSocket() client: Socket) {
    const user = this.clients.get(client)
    if (!user) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'User not authenticated',
      })
      return
    }

    try {
      const player = await this.blackjackService.hit(data.gameId, user.sub)
      client.emit('player-hit', { gameId: data.gameId, player })
      await this.realtimeService.leaderboard()
    } catch (error) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: error.message,
      })
    }
  }

  @SubscribeMessage('stand-blackjack')
  async handleStandBlackjack(@MessageBody() data: GameIdDTO, @ConnectedSocket() client: Socket) {
    const user = this.clients.get(client)
    if (!user) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'User not authenticated',
      })
      return
    }

    try {
      const player = await this.blackjackService.stand(data.gameId, user.sub)
      client.emit('player-stand', { gameId: data.gameId, player })

      if (await this.blackjackService.allPlayersStood(data.gameId)) {
        await this.blackjackService.dealerPlay(data.gameId)
        client.emit('dealer-played', { gameId: data.gameId })
      }
      await this.realtimeService.leaderboard()
    } catch (error) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: error.message,
      })
    }
  }

  @SubscribeMessage('leave-blackjack')
  async handleLeaveBlackjack(@MessageBody() data: GameIdDTO, @ConnectedSocket() client: Socket) {
    const user = this.clients.get(client)
    if (!user) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'User not authenticated',
      })
      return
    }

    try {
      await this.blackjackService.leaveGame(data.gameId, user.sub)
      client.emit('blackjack-game-left', { gameId: data.gameId, player: user.sub })
      await this.realtimeService.leaderboard()
    } catch (error) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: error.message,
      })
    }
  }

  @SubscribeMessage('start-blindbox')
  async handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() { tickets }: StartBlindBoxGameDTO,
  ) {
    const user = this.clients.get(client)
    if (!user) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'User not connected',
      })
      client.disconnect()
      return
    }

    const { sub } = user
    const stat = await this.prisma.stat.findUnique({
      where: { userId: sub },
    })

    if (stat.tickets < tickets) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'Out of ticket. Buy more tickets',
      })
      client.disconnect()
      return
    }

    const board = this.realtimeService.createGameBoard()
    this.games.set(sub, { board, points: 0 })

    client.emit('blindbox-started', { boardSize: 4, tickets })

    await this.prisma.stat.update({
      where: { userId: sub },
      data: { tickets: { decrement: tickets } },
    })
  }

  @SubscribeMessage('select-box')
  async handleSelectBox(
    @ConnectedSocket() client: Socket,
    @MessageBody() { row, column }: SelectBoxDTO,
  ) {
    const user = this.clients.get(client)
    if (!user) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'User not connected',
      })
      client.disconnect()
      return
    }

    const { sub } = user
    const game = this.games.get(sub)
    if (!game) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: 'Game not started',
      })
      return
    }

    const { board } = game
    const selected = board[row][column]
    if (selected === 'bomb') {
      this.games.delete(sub)
      client.emit('blindbox-game-over', { points: 0 })
      await this.prisma.stat.update({
        where: { userId: sub },
        data: { total_losses: { increment: 1 } }
      })
      return
    }

    game.points += 2
    board[row][column] = 'selected'

    const remainingGems = board.flat().filter(cell => cell === 'gem').length
    if (remainingGems === 0) {
      client.emit('blindbox-game-won', { points: game.points })
      this.realtimeService.saveGameResult(sub, game.points)
      this.games.delete(sub)
    } else {
      client.emit('box-selected', { points: game.points, remainingGems })
    }
  }

  @SubscribeMessage('end-blindbox')
  async handleEndGame(@ConnectedSocket() client: Socket) {
    const user = this.clients.get(client)
    if (!user) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'User not connected',
      })
      client.disconnect()
      return
    }

    const { sub } = user
    const game = this.games.get(sub)
    if (!game) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: 'Game not started',
      })
      return
    }

    client.emit('blindbox-ended', { points: game.points })

    await this.realtimeService.saveGameResult(sub, game.points)
    this.games.delete(sub)

    await this.realtimeService.leaderboard()
  }
}
