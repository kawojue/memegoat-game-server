import { Server } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { RandomService } from 'libs/random.service';
import { PrismaService } from 'prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
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

  async leaderboard() {
    await Promise.all([
      this.updateOverallLeaderboard(),
      this.getCurrentTournamentLeaderboard(),
    ]);
  }

  private async updateOverallLeaderboard() {
    const leaderboard = await this.prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        stat: {
          select: {
            total_points: true,
          },
        },
        avatar: true,
        address: true,
        username: true,
      },
      orderBy: {
        stat: {
          total_points: 'desc',
        },
      },
    });

    this.getServer().emit('overall-leaderboard', { leaderboard });
  }

  private async getCurrentTournamentLeaderboard() {
    const currentTournament = await this.prisma.tournament.findFirst({
      where: {
        start: { lte: new Date() },
        end: { gte: new Date() },
      },
    });

    if (!currentTournament) {
      this.getServer().emit('tournament-leaderboard', { leaderboard: [] });
      return;
    }

    const leaderboard = await this.prisma.user.findMany({
      where: {
        rounds: {
          some: {
            createdAt: {
              gte: currentTournament.start,
              lte: currentTournament.end,
            },
          },
        },
      },
      select: {
        id: true,
        avatar: true,
        address: true,
        username: true,
        rounds: {
          where: {
            createdAt: {
              gte: currentTournament.start,
              lte: currentTournament.end,
            },
          },
          select: {
            point: true,
          },
        },
      },
    });

    const sortedLeaderboard = leaderboard.map((user) => {
      const totalPoints = user.rounds.reduce(
        (acc, round) => acc + round.point,
        0,
      );
      return {
        ...user,
        totalRounds: user.rounds.length,
        totalPoints,
        rounds: undefined,
      };
    });

    sortedLeaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

    this.getServer().emit('tournament-leaderboard', {
      currentTournament,
      leaderboard: sortedLeaderboard,
    });
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
      this.getServer().to(gameId).emit('blackjack-state', gameState);
    }

    await this.leaderboard();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleDisconnectionTimeouts() {
    const gracePeriod = 1 * 60 * 1000;

    const players = await this.prisma.player.findMany({
      where: { disconnectedAt: { not: null } },
    });

    for (const player of players) {
      if (
        new Date().getTime() - new Date(player.disconnectedAt).getTime() >
        gracePeriod
      ) {
        await this.forfeitGame(player.gameId, player.userId);
      }
    }
  }

  createGameBoard() {
    const board = Array.from({ length: 4 }, () => Array(4).fill('gem'));
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

  async saveGameResult(userId: string, points: number) {
    await this.prisma.stat.update({
      where: { userId },
      data: {
        total_points: { increment: points },
      },
    });

    await this.prisma.round.create({
      data: {
        point: points,
        game_type: 'BlindBox',
        user: { connect: { id: userId } },
      },
    });
  }
}
