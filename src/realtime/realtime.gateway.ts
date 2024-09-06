import {
  DiceDTO,
  GameIdDTO,
  LotteryDTO,
  CoinFlipDTO,
  RouletteDTO,
  SelectBoxDTO,
  EndSpaceInvaderDTO,
  StartBlindBoxGameDTO,
  StartSpaceInvaderDTO,
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
import { env } from 'configs/env.config'
import { JwtService } from '@nestjs/jwt'
import { GameType } from '@prisma/client'
import { Server, Socket } from 'socket.io'
import { StatusCodes } from 'enums/StatusCodes'
import { MiscService } from 'libs/misc.service'
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
      'https://beta-games.memegoat.io',
      'https://games-server.memegoat.io',
      'https://memegoat-games.vercel.app',
    ],
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayInit, OnGatewayDisconnect {
  @WebSocketServer() server: Server

  constructor(
    private readonly misc: MiscService,
    private readonly prisma: PrismaService,
    private readonly random: RandomService,
    private readonly jwtService: JwtService,
    private readonly realtimeService: RealtimeService,
    private readonly blackjackService: BlackjackService,
  ) { }

  private clients: Map<Socket, JwtPayload> = new Map()
  private onlineUsers: Map<string, string> = new Map()
  private blindBoxGames: Map<string, BlindBox> = new Map()
  private spaceInvaderGames: Map<string, SpaceInvader> = new Map()

  afterInit() {
    this.realtimeService.setServer(this.server)
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.headers['authorization']?.split('Bearer ')[1]

    if (token) {
      try {
        const { sub, address } = await this.jwtService.verifyAsync(token, {
          secret: env.jwt.secret,
          ignoreExpiration: false,
        }) as JwtPayload

        const userData = await this.prisma.user.findUnique({
          where: { id: sub },
          select: { active: true },
        })

        if (!userData) {
          client.emit('error', {
            status: StatusCodes.NotFound,
            message: 'Account not found',
          })
          client.disconnect()
          return
        }

        if (!userData.active) {
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

    const stat = await this.prisma.stat.findFirst({
      where: {
        userId: sub,
        tickets: { gte: stake }
      },
    })

    if (!stat) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'Out of tickets. Buy more tickets',
      })
      return
    }

    const currentTournament = await this.realtimeService.currentTournament()
    if (!currentTournament) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'No active tournament',
      })
      return
    }

    const { random } = this.random.randomize()
    const outcome = random < 0.5 ? 'heads' : 'tails'

    const win = outcome === guess
    const point = win ? stake * 2 : 0
    const updateData = win ? { total_wins: { increment: 1 }, total_points: { increment: point } } : { total_losses: { increment: 1 } }

    const round = {
      point: point, stake: stake,
      game_type: 'CoinFlip' as GameType,
    }

    const savedRound = await this.prisma.round.create({
      data: {
        ...round,
        user: { connect: { id: sub } },
      },
    })

    await this.prisma.stat.update({
      where: { userId: sub },
      data: {
        tickets: { decrement: stake },
        ...updateData,
      },
    })

    client.emit('coin-flip-result', { ...round, win, outcome })

    if (savedRound) {
      await this.realtimeService.updateUniqueUsersForCurrentTournament(
        currentTournament.id,
        stake, sub,
        currentTournament.start,
        currentTournament.end,
      )
    }
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
      return
    }

    if (guesses.length !== numDice || !guesses.every((guess) => guess >= 1 && guess <= 6)) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: 'Invalid guesses for the number of dice',
      })
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

    const stat = await this.prisma.stat.findFirst({
      where: {
        userId: sub,
        tickets: { gte: stake }
      },
    })

    if (!stat) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'Out of tickets. Buy more tickets',
      })
      return
    }

    const currentTournament = await this.realtimeService.currentTournament()
    if (!currentTournament) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'No active tournament',
      })
      return
    }

    const rolls = Array.from({ length: numDice }, () => Math.floor(this.random.randomize().random * 6) + 1)

    const sortedRolls = [...rolls].sort()
    const sortedGuesses = [...guesses].sort()

    const win = sortedRolls.every((roll, index) => roll === sortedGuesses[index])
    const point = this.realtimeService.calculateDicePoint(stake, numDice, win)
    const updateData = win
      ? { total_wins: { increment: 1 }, total_points: { increment: point } }
      : { total_losses: { increment: 1 } }

    const round = {
      point: point, stake: stake,
      game_type: 'Dice' as GameType,
    }

    const savedRound = await this.prisma.round.create({
      data: {
        ...round,
        user: { connect: { id: sub } },
      },
    })

    await this.prisma.stat.update({
      where: { userId: sub },
      data: {
        tickets: { decrement: stake },
        ...updateData,
      },
    })

    client.emit('dice-roll-result', { ...round, win, rolls })

    if (savedRound) {
      await this.realtimeService.updateUniqueUsersForCurrentTournament(
        currentTournament.id,
        stake, sub,
        currentTournament.start,
        currentTournament.end,
      )
    }
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
      return
    }

    if (betType === 'number' && (number < 0 || number > 36)) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: 'Number must be between 0 and 36',
      })
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

    const stat = await this.prisma.stat.findFirst({
      where: {
        userId: sub,
        tickets: { gte: stake }
      },
    })

    if (!stat) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'Out of tickets. Buy more tickets',
      })
      return
    }

    const currentTournament = await this.realtimeService.currentTournament()
    if (!currentTournament) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'No active tournament',
      })
      return
    }

    const outcome = Math.floor(this.random.randomize().random * 37)
    const outcomeColor = outcome === 0 ? 'green' : outcome % 2 === 0 ? 'black' : 'red'
    const outcomeParity = outcome === 0 ? 'neither' : outcome % 2 === 0 ? 'even' : 'odd'

    const win =
      (betType === 'number' && number === outcome) ||
      (betType === 'color' && number === (outcomeColor === 'red' ? 1 : outcomeColor === 'black' ? 2 : 0)) ||
      (betType === 'parity' && number === (outcomeParity === 'even' ? 1 : outcomeParity === 'odd' ? 2 : 0))

    const point = win ? betType === 'number' ? stake * 35 : stake * 2 : 0
    const updateData = win ? { total_wins: { increment: 1 }, total_points: { increment: point } } : { total_losses: { increment: 1 } }

    const round = {
      point: point, stake: stake,
      game_type: 'Roulette' as GameType,
    }

    const result = betType === 'number' ? outcome : betType === 'color' ? outcomeColor : outcomeParity

    const savedRound = await this.prisma.round.create({
      data: {
        ...round,
        user: { connect: { id: sub } },
      },
    })

    await this.prisma.stat.update({
      where: { userId: sub },
      data: {
        tickets: { decrement: stake },
        ...updateData
      },
    })

    client.emit('roulette-spin-result', { ...round, win, outcome, result })

    if (savedRound) {
      await this.realtimeService.updateUniqueUsersForCurrentTournament(
        currentTournament.id,
        stake, sub,
        currentTournament.start,
        currentTournament.end,
      )
    }
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
      where: {
        userId: sub,
        tickets: { gte: tickets }
      },
    })

    if (!stat) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'Out of tickets. Buy more tickets',
      })
      return
    }

    const currentTournament = await this.realtimeService.currentTournament()
    if (!currentTournament) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'No active tournament',
      })
      return
    }

    const board = this.realtimeService.createGameBoard()
    this.blindBoxGames.set(sub, {
      points: 0,
      board: board,
      stake: tickets
    })

    const newStat = await this.prisma.stat.update({
      where: { userId: sub },
      data: { tickets: { decrement: tickets } },
    })

    client.emit('blindbox-started', { boardSize: 4, tickets })

    if (newStat) {
      await this.realtimeService.updateUniqueUsersForCurrentTournament(
        currentTournament.id,
        tickets, sub,
        currentTournament.start,
        currentTournament.end,
      )
    }
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
    const game = this.blindBoxGames.get(sub)
    if (!game) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: 'Game not started',
      })
      return
    }

    const { board, stake } = game
    const selected = board[row][column]
    if (selected === 'bomb') {
      this.blindBoxGames.delete(sub)
      client.emit('blindbox-game-over', { points: 0 })
      await this.prisma.stat.update({
        where: { userId: sub },
        data: { total_losses: { increment: 1 } }
      })
      return
    }

    let remainingGems = board.flat().filter(cell => cell === 'gem').length
    const successfulSelections = board.flat().filter(cell => cell === 'selected').length

    const remainingCells = 16 - successfulSelections
    const probability = remainingGems / remainingCells
    const odds = (1 / probability) - 1

    const pointsToAdd = stake * odds + stake

    game.points += pointsToAdd

    board[row][column] = 'selected'

    remainingGems = board.flat().filter(cell => cell === 'gem').length

    if (remainingGems === 0) {
      client.emit('blindbox-game-won', { points: game.points })
      await this.prisma.stat.update({
        where: { userId: sub },
        data: { total_wins: { increment: 1 } }
      })
      await this.realtimeService.saveBlindBoxGameResult(sub, game)
      this.blindBoxGames.delete(sub)
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
    const game = this.blindBoxGames.get(sub)
    if (!game) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: 'Game not started',
      })
      return
    }

    if (game.points > game.stake) {
      const newPoints = game.points - game.stake
      if (newPoints > 0) {
        game.points = newPoints
      }
    }

    await this.realtimeService.saveBlindBoxGameResult(sub, game)

    client.emit('blindbox-ended', { points: game.points })
    this.blindBoxGames.delete(sub)
  }

  @SubscribeMessage('play-lottery')
  async lottery(@ConnectedSocket() client: Socket, { digits, stake }: LotteryDTO) {
    const user = this.clients.get(client)
    if (!user) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'User not connected',
      })
      client.disconnect()
      return
    }

    if (digits.length !== 6) {
      client.emit('', {
        status: StatusCodes.BadRequest,
        message: "Lottery digits must be exactly 6-digits number"
      })
      return
    }

    const { sub } = user
    const stat = await this.prisma.stat.findFirst({
      where: {
        userId: sub,
        tickets: { gte: stake }
      },
    })

    if (!stat) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'Out of tickets. Buy more tickets',
      })
      return
    }

    const currentTournament = await this.realtimeService.currentTournament()
    if (!currentTournament) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'No active tournament',
      })
      return
    }

    const round = await this.prisma.round.create({
      data: {
        stake,
        game_type: 'LOTTERY',
        lottery_digits: digits,
        user: { connect: { id: sub } },
      },
      include: {
        user: {
          select: {
            avatar: true,
            username: true,
          }
        }
      }
    })

    await this.prisma.stat.update({
      where: { userId: sub },
      data: {
        tickets: { decrement: stake },
      },
    })

    client.emit('lottery-data', { round })

    client.broadcast.emit('new-lottery-round', { round })

    if (round) {
      await this.realtimeService.updateUniqueUsersForCurrentTournament(
        currentTournament.id,
        stake, sub,
        currentTournament.start,
        currentTournament.end,
      )
    }
  }

  @SubscribeMessage('get-latest-lottery-rounds')
  async getLatestRounds(@ConnectedSocket() client: Socket) {
    const latestRounds = await this.prisma.round.findMany({
      where: { game_type: 'LOTTERY' },
      take: 15,
      include: {
        user: {
          select: {
            avatar: true,
            username: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    })

    client.emit('latest-lottery-rounds', { rounds: latestRounds })
  }

  @SubscribeMessage('start-space-invader')
  async startSpaceInvaders(@ConnectedSocket() client: Socket, @MessageBody() { lives }: StartSpaceInvaderDTO) {
    const stake = this.misc.calculateSpaceInvaderTicketByLives(lives)

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
    const stat = await this.prisma.stat.findFirst({
      where: {
        userId: sub,
        tickets: { gte: stake }
      },
    })

    if (!stat) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'Out of tickets. Buy more tickets',
      })
      return
    }

    const currentTournament = await this.realtimeService.currentTournament()
    if (!currentTournament) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'No active tournament',
      })
      return
    }

    this.spaceInvaderGames.set(sub, { lives, stake })

    client.emit('space-invader-started', { lives, stake })

    await this.realtimeService.updateUniqueUsersForCurrentTournament(
      currentTournament.id,
      stake, sub,
      currentTournament.start,
      currentTournament.end,
    )
  }

  @SubscribeMessage('end-space-invader')
  async endSpaceInvaders(@ConnectedSocket() client: Socket, @MessageBody() { points }: EndSpaceInvaderDTO) {
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
    const game = this.spaceInvaderGames.get(sub)

    if (!game) {
      client.emit('error', {
        status: StatusCodes.NotFound,
        message: 'Game not found',
      })
      return
    }

    const currentTournament = await this.realtimeService.currentTournament()
    if (!currentTournament) {
      client.emit('error', {
        status: StatusCodes.UnprocessableEntity,
        message: 'No active tournament. Your tickets have been reversed',
      })

      await this.prisma.tournament.update({
        where: { key: currentTournament.key },
        data: { totalStakes: { decrement: game.stake } }
      })

      return
    }

    let totalPoints = points * game.lives
    const throttle = Math.floor(points / game.stake)

    if (points > (game.stake / 2)) {
      if (throttle > 1) {
        totalPoints = throttle * points + game.stake
      } else {
        totalPoints = points + game.stake
      }
    }

    const round = await this.prisma.round.create({
      data: {
        lives: game.lives,
        stake: game.stake,
        point: totalPoints,
        game_type: 'SpaceInvader',
        user: { connect: { id: sub } }
      }
    })

    client.emit('space-invader-ended', { points: totalPoints })

    if (round) {
      await this.prisma.stat.update({
        where: { userId: sub },
        data: {
          tickets: { decrement: game.stake },
          total_points: { increment: totalPoints }
        }
      })
      this.spaceInvaderGames.delete(sub)
    }
  }
}
