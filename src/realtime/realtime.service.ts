import { Server } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { RandomService } from 'libs/random.service';
import { PrismaService } from 'prisma/prisma.service';
// import { Cron, CronExpression } from '@nestjs/schedule';
import { BlackjackService } from 'libs/blackJack.service';

@Injectable()
export class RealtimeService {
  private server: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly randomService: RandomService,
    private readonly blackjackService: BlackjackService,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  getServer(): Server {
    return this.server;
  }

  async forfeitGame(gameId: string, userId: string): Promise<void> {
    const player = await this.prisma.player.findFirst({
      where: { userId, gameId },
    });

    if (!player) return;

    await this.prisma.player.update({
      where: { id: player.id },
      data: { result: 'forfeit' },
    });

    const remainingPlayers = await this.prisma.player.findMany({
      where: { gameId, result: null },
    });

    if (remainingPlayers.length === 0) {
      await this.blackjackService.leaveGame(gameId, userId);
    } else {
      const gameState = await this.blackjackService.getGameState(gameId);
      this.server.to(gameId).emit('blackjack-state', gameState);
    }
  }

  // @Cron(CronExpression.EVERY_MINUTE)
  // async handleDisconnectionTimeouts() {
  //   const gracePeriod = 1 * 60 * 1000

  //   const players = await this.prisma.player.findMany({
  //     where: { disconnectedAt: { not: null } },
  //   })

  //   for (const player of players) {
  //     if (
  //       new Date(new Date().toUTCString()).getTime() - new Date(player.disconnectedAt).getTime() >
  //       gracePeriod
  //     ) {
  //       await this.forfeitGame(player.gameId, player.userId)
  //     }
  //   }
  // }

  calculateDicePoint(stake: number, numDice: number, win: boolean) {
    if (!win) return 0;

    const probability = Math.pow(1 / 6, numDice);
    const odds = 1 / probability - 1;

    return stake * odds + stake;
  }

  createGameBoard() {
    const board: string[][] = Array.from({ length: 4 }, () =>
      Array(4).fill('gem'),
    );
    let bombsPlaced = 0;
    while (bombsPlaced < 5) {
      const row = Math.floor(this.randomService.randomize().random * 4);
      const column = Math.floor(this.randomService.randomize().random * 4);
      if (board[row][column] === 'gem') {
        board[row][column] = 'bomb';
        bombsPlaced++;
      }
    }
    return board;
  }

  async saveBlindBoxGameResult(userId: string, game: BlindBox) {
    await this.prisma.stat.update({
      where: { userId },
      data: {
        total_sport_wins: { increment: 1 },
        total_points: { increment: game.points },
        xp: { increment: Math.sqrt(game.points) },
      },
    });
    await this.prisma.round.create({
      data: {
        stake: game.stake,
        point: game.points,
        game_type: 'BlindBox',
        user: { connect: { id: userId } },
        gameTournament: { connect: { id: game.currentTournamentId } },
      },
    });
  }

  async updateStat(userId: string, win: boolean, stake: number, point: number) {
    const updatedData = win
      ? {
          total_wins: { increment: 1 },
          total_points: { increment: point },
          xp: { increment: Math.sqrt(point) },
        }
      : { total_losses: { increment: 1 } };

    return await this.prisma.stat.update({
      where: { id: userId },
      data: {
        tickets: { decrement: stake },
        ...updatedData,
      },
    });
  }
}
