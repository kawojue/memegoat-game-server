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
import { Server, Socket } from 'socket.io'
import { StatusCodes } from 'enums/StatusCodes'
import { RandomService } from 'libs/random.service'
import { RealtimeService } from './realtime.service'
import { PrismaService } from 'prisma/prisma.service'
import { CoinFlipDTO, DiceDTO, RouletteDTO } from './dto/index.dto'

@WebSocketGateway({
  transports: ['polling', 'websocket'],
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
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
  ) { }

  private clients: Map<Socket, JwtPayload> = new Map()
  private onlineUsers: Map<string, string> = new Map()

  afterInit() {
    this.realtimeService.setServer(this.server)
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.headers['authorization']?.split('Bearer ')[1]
    if (!token) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'Token does not exist',
      })
      client.disconnect()
      return
    }

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

      client.emit('connected', { message: 'Connected' })
    } catch (err) {
      client.emit('error', {
        status: StatusCodes.InternalServerError,
        message: err.message,
      })
      client.disconnect()
    }
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
    this.server.emit('online-user-count', onlineUserCount)
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

    const [round] = await this.prisma.$transaction([
      this.prisma.round.create({
        data: {
          game_type: 'CoinFlip',
          point: point,
          user: { connect: { id: sub } },
        },
      }),
      this.prisma.stat.update({
        where: { userId: sub },
        data: { tickets: { decrement: stake } },
      }),
      this.prisma.stat.update({
        where: { userId: sub },
        data: updateData,
      }),
    ])

    client.emit('coin-flip-result', { round, win, outcome, stake: stake })

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

    const [round] = await this.prisma.$transaction([
      this.prisma.round.create({
        data: {
          game_type: 'Dice',
          point: point,
          user: { connect: { id: sub } },
        },
      }),
      this.prisma.stat.update({
        where: { userId: sub },
        data: { tickets: { decrement: stake } },
      }),
      this.prisma.stat.update({
        where: { userId: sub },
        data: updateData,
      }),
    ])

    client.emit('dice-roll-result', { round, win, rolls, stake })

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

    const [round] = await this.prisma.$transaction([
      this.prisma.round.create({
        data: {
          game_type: 'Roulette',
          point: point,
          user: { connect: { id: sub } },
        },
      }),
      this.prisma.stat.update({
        where: { userId: sub },
        data: { tickets: { decrement: stake } },
      }),
      this.prisma.stat.update({
        where: { userId: sub },
        data: updateData,
      }),
    ])

    client.emit('roulette-spin-result', { round, win, outcome, stake })

    await this.realtimeService.leaderboard()
  }
}
