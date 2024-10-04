import { Queue } from 'bullmq';
import { subDays } from 'date-fns';
import { Prisma } from '@prisma/client';
import { env } from 'configs/env.config';
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { calculatePayableTickets } from 'utils/math';
import { PrismaService } from 'prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { contractDTO, ContractService } from 'libs/contract.service';
import { RewardData, TournamentService, txData } from 'libs/tournament.service';
import BigNumber from 'bignumber.js';

@Injectable()
export class TaskService {
  constructor(
    private prisma: PrismaService,
    private contract: ContractService,
    private tournamentReward: TournamentService,
    @InjectQueue('sports-football-queue') private sportQueue: Queue,
    @InjectQueue('transactions-queue') private transactionQueue: Queue,
  ) {}

  calculateLotteryPoints(
    guess: string,
    outcome: string,
    stake: number,
  ): number {
    let matches = 0;

    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === outcome[i]) {
        matches++;
      }
    }

    if (matches === 0) {
      return 0;
    }

    const multiplier = Math.pow(2, matches);
    const points = stake * multiplier;

    return points;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async refreshFootballBets() {
    const batchSize = 19; // max is 20, I am just being skeptical
    let cursorId: string | null = null;

    const currentTournament = await this.prisma.sportTournament.findFirst({
      where: {
        start: { lte: new Date(new Date().toUTCString()) },
        end: { gte: new Date(new Date().toUTCString()) },
      },
    });

    if (!currentTournament || (currentTournament && currentTournament.paused)) {
      return;
    }

    while (true) {
      const bets = await this.prisma.sportBet.findMany({
        where: {
          outcome: 'NOT_DECIDED',
          fixureId: { not: null },
          status: { in: ['ONGOING', 'NOT_STARTED'] },
        },
        take: batchSize,
        orderBy: { createdAt: 'desc' },
        ...(cursorId && { cursor: { id: cursorId }, skip: 1 }),
        select: {
          id: true,
          fixureId: true,
        },
      });

      if (bets.length === 0) {
        break;
      }

      const batchIds = bets.map((bet) => bet.fixureId).join('-');

      await this.sportQueue.add('sports-football-queue', { batchIds });

      cursorId = bets[bets.length - 1].id;

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async updateTransactions() {
    const batchSize = 100;
    let cursorId: string | null = null;
    const sevenDaysAgo = subDays(new Date(new Date().toUTCString()), 7);

    while (true) {
      const transactions = await this.prisma.transaction.findMany({
        where: {
          txStatus: 'Pending',
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
        take: batchSize,
        ...(cursorId && { cursor: { id: cursorId }, skip: 1 }),
        select: { id: true, txId: true },
        orderBy: { createdAt: 'desc' },
      });

      if (transactions.length === 0) {
        break;
      }

      for (const transaction of transactions) {
        await this.transactionQueue.add('cron.transaction', { transaction });
      }

      cursorId = transactions[transactions.length - 1].id;

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_4PM, {
    timeZone: 'UTC',
  })
  async updateLotterySession() {
    const data: contractDTO = {
      contract: 'memegoat-lottery-rng',
      function: 'get-final-number',
      arguments: [],
    };

    const rng = await this.contract.readContract(data);
    const outcome = rng.slice(1).split('').reverse().join('');

    const batchSize = 50;
    let cursorId: string | null = null;

    let isLotteryDrawCreated = false;

    while (true) {
      const twentyFourHoursAgo = new Date(
        new Date().getTime() - 24 * 60 * 60 * 1000,
      );

      const recentRounds = await this.prisma.round.findMany({
        where: {
          point: { lte: 0 },
          game_type: 'LOTTERY',
          createdAt: {
            gte: twentyFourHoursAgo,
          },
        },
        take: batchSize,
        ...(cursorId && { cursor: { id: cursorId }, skip: 1 }),
        orderBy: { createdAt: 'desc' },
      });

      const roundsWithNullOutcome = recentRounds.filter(
        (round) => round.lottery_outcome_digits === null,
      );

      if (roundsWithNullOutcome.length === 0) {
        break;
      }

      await Promise.all(
        roundsWithNullOutcome.map(async (round) => {
          const points = this.calculateLotteryPoints(
            round.lottery_digits,
            outcome,
            round.stake,
          );

          await this.prisma.retryTransaction(async () => {
            await this.prisma.round.update({
              where: { id: round.id },
              data: {
                point: points,
                lottery_outcome_digits: outcome,
              },
            });

            await this.prisma.stat.update({
              where: { userId: round.userId },
              data: {
                total_points: { increment: points },
                xp: { increment: Math.sqrt(points) },
                ...(points > round.stake && { total_wins: { increment: 1 } }),
                ...(points < round.stake && { total_losses: { increment: 1 } }),
              },
            });
          });

          await new Promise((resolve) => setTimeout(resolve, 100));
        }),
      );

      cursorId = recentRounds[recentRounds.length - 1].id;

      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!isLotteryDrawCreated) {
        await this.prisma.lotteryDraw.create({
          data: { digits: outcome },
        });
        isLotteryDrawCreated = true;
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async rewardAndRefreshGameTournament() {
    let currentTime = new Date(new Date().toUTCString());

    const whereClause: Prisma.TournamentWhereInput = {
      OR: [
        {
          end: {
            lte: new Date(currentTime.getTime() + 30 * 60 * 1000),
            gte: currentTime,
          },
        },
        {
          end: {
            lte: currentTime,
          },
        },
      ],
      paused: false,
      disbursed: false,
    };

    const tournamentsToProcess = await this.prisma.tournament.findMany({
      where: whereClause,
    });

    const allTxData: txData[] = [];

    for (const tournament of tournamentsToProcess) {
      await this.prisma.retryTransaction(async () => {
        await this.prisma.tournament.update({
          where: { id: tournament.id },
          data: { paused: true },
        });

        const leaderboard = await this.prisma.user.findMany({
          where: { active: true },
          select: {
            id: true,
            address: true,
            rounds: {
              where: { gameTournamentId: tournament.id },
              select: { stake: true, point: true },
            },
          },
        });

        const {
          _sum: { stake: totalTournamentStakes },
        } = await this.prisma.round.aggregate({
          where: { gameTournamentId: tournament.id },
          _sum: {
            stake: true,
          },
        });

        const groupRoundsByUser = await this.prisma.round.groupBy({
          where: { gameTournamentId: tournament.id },
          by: ['userId'],
        });

        const leaderboardWithPoints = leaderboard.map((user) => {
          const totalPoints = user.rounds.reduce(
            (acc, round) => acc + round?.point || 0,
            0,
          );
          return { ...user, totalPoints };
        });

        const sortedLeaderboard = leaderboardWithPoints.sort(
          (a, b) => b.totalPoints - a.totalPoints,
        );

        const participatedUsers = groupRoundsByUser.length;

        let numberOfUsersToReward = Math.ceil(participatedUsers / 10);

        if (participatedUsers <= 10) {
          numberOfUsersToReward = Math.ceil(participatedUsers / 3);
        }

        if (participatedUsers <= 5) {
          numberOfUsersToReward = Math.ceil(participatedUsers / 2);
        }

        const usersToReward = sortedLeaderboard.slice(0, numberOfUsersToReward);

        if (usersToReward.length === 0) {
          return;
        }

        const totalPointsForPickedUsers = usersToReward.reduce(
          (acc, user) => acc + user.totalPoints,
          0,
        );

        const ticketRecord = await this.prisma.ticketRecords.findFirst({
          where: {
            rolloverRatio: 0,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        let rolloverTickets = 0;
        let rolloverRatio = 0;
        let totalSold = 0;
        let totalFree = 0;

        if (ticketRecord) {
          if (ticketRecord.lastId) {
            const prevRecord = await this.prisma.ticketRecords.findUnique({
              where: { id: ticketRecord.lastId },
            });
            if (prevRecord) {
              rolloverRatio = prevRecord.rolloverRatio;
              rolloverTickets = prevRecord.rolloverTickets;
            }
          }
          totalFree = ticketRecord.freeTickets;
          totalSold = ticketRecord.boughtTickets;
        }

        const payableRecord = calculatePayableTickets(
          {
            rolloverTickets: rolloverTickets,
            rolloverRatio: rolloverRatio,
          },
          {
            totalTicketsUsed: totalTournamentStakes,
            totalFreeTickets: totalFree,
            totalTicketsBought: totalSold,
          },
        );

        await this.prisma.ticketRecords.update({
          where: { id: ticketRecord.id },
          data: {
            usedTickets: totalTournamentStakes,
            rolloverRatio: payableRecord.rolloverRatio * 1e6,
            rolloverTickets: payableRecord.rolloverTickets,
          },
        });

        await this.prisma.ticketRecords.create({
          data: {
            lastId: ticketRecord.id,
          },
        });

        const rewardData: RewardData[] = [];

        const remaining = new BigNumber(payableRecord.payableTickets)
          .multipliedBy(new BigNumber('98'))
          .div(new BigNumber('100'));

        for (const user of usersToReward) {
          const userProportion = new BigNumber(user.totalPoints).div(
            new BigNumber(totalPointsForPickedUsers),
          );
          const userEarnings = remaining.multipliedBy(userProportion);

          const roundedUserEarnings = userEarnings.decimalPlaces(
            3,
            BigNumber.ROUND_FLOOR,
          );

          if (userEarnings) {
            await this.prisma.reward.create({
              data: {
                userId: user.id,
                earning: roundedUserEarnings.toString(),
                points: user.totalPoints,
                gameTournamentId: tournament.id,
                claimed: 'DEFAULT',
                type: 'GAME',
                totalTournamentPoints: totalPointsForPickedUsers,
              },
            });

            rewardData.push({
              addr: user.address,
              amount:
                Number(roundedUserEarnings.toString()) * env.hiro.ticketPrice,
            });
          }
        }

        allTxData.push({
          rewardData,
          totalTicketsUsed: payableRecord.payableTickets,
          totalNoOfPlayers: participatedUsers,
          tournamentId: tournament.id,
        });

        await this.prisma.tournament.update({
          where: { id: tournament.id },
          data: {
            disbursed: true,
            numberOfUsersRewarded: usersToReward.length,
          },
        });
      }, 2);
    }

    for (const tx of allTxData) {
      await this.tournamentReward.storeTournamentRewards(tx, 1);
      await new Promise((resolve) => setTimeout(resolve, 3600));
    }

    currentTime = new Date(new Date().toUTCString());
    let currentTournament = await this.prisma.tournament.findFirst({
      where: {
        start: { lte: currentTime },
        end: { gte: currentTime },
      },
    });

    if (currentTournament && currentTournament.paused) {
      return;
    }

    if (!currentTournament) {
      const start = currentTime;
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 7);

      currentTournament = await this.prisma.tournament.create({
        data: { start, end },
      });
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async rewardAndRefreshSportTournament() {
    let currentTime = new Date(new Date().toUTCString());

    const whereClause: Prisma.SportTournamentWhereInput = {
      OR: [
        {
          end: {
            lte: new Date(currentTime.getTime() + 30 * 60 * 1000),
            gte: currentTime,
          },
        },
        {
          end: {
            lte: currentTime,
          },
        },
      ],
    };

    const tournamentsToProcess = await this.prisma.sportTournament.findMany({
      where: whereClause,
    });

    const allTxData: txData[] = [];

    for (const tournament of tournamentsToProcess) {
      await this.prisma.retryTransaction(async () => {
        await this.prisma.sportTournament.update({
          where: { id: tournament.id },
          data: { paused: true },
        });

        const whereClause: Prisma.SportBetWhereInput = {
          disbursed: false,
          status: 'FINISHED',
          outcome: { in: ['WIN', 'LOSE'] },
          sportTournamentId: tournament.id,
        };

        const betsAggregate = await this.prisma.sportBet.aggregate({
          where: whereClause,
          _sum: { stake: true },
        });

        const leaderboard = await this.prisma.user.findMany({
          where: { active: true },
          select: {
            id: true,
            address: true,
            sportBets: {
              where: whereClause,
              select: {
                id: true,
                sportRound: {
                  select: { point: true },
                },
              },
            },
          },
        });

        const groupBetsBy = await this.prisma.sportBet.groupBy({
          where: whereClause,
          by: ['userId'],
        });

        let totalTournamentPoints = 0;

        const leaderboardWithPoints = leaderboard.map((user) => {
          const totalPoints = user.sportBets.reduce(
            (acc, bet) => acc + (bet.sportRound?.point || 0),
            0,
          );
          totalTournamentPoints += totalPoints;
          return { ...user, totalPoints };
        });

        const sortedLeaderboard = leaderboardWithPoints.sort(
          (a, b) => b.totalPoints - a.totalPoints,
        );

        const participatedUsers = groupBetsBy.length;

        let numberOfUsersToReward = Math.ceil(participatedUsers / 10);

        if (participatedUsers <= 10) {
          numberOfUsersToReward = Math.ceil(participatedUsers / 5);
        }

        if (participatedUsers <= 5) {
          numberOfUsersToReward = Math.ceil(participatedUsers / 2);
        }

        const usersToReward = sortedLeaderboard.slice(0, numberOfUsersToReward);

        const totalPointsForPickedUsers = usersToReward.reduce(
          (acc, user) => acc + user.totalPoints,
          0,
        );

        const ticketRecord = await this.prisma.ticketRecords.findFirst({
          where: {
            rolloverRatio: 0,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        let rolloverTickets = 0;
        let rolloverRatio = 0;
        let totalSold = 0;
        let totalFree = 0;

        if (ticketRecord) {
          if (ticketRecord.lastId) {
            const prevRecord = await this.prisma.ticketRecords.findUnique({
              where: { id: ticketRecord.lastId },
            });
            if (prevRecord) {
              rolloverRatio = prevRecord.rolloverRatio;
              rolloverTickets = prevRecord.rolloverTickets;
            }
          }
          totalFree = ticketRecord.freeTickets;
          totalSold = ticketRecord.boughtTickets;
        }

        const totalStakes = betsAggregate._sum.stake;

        const payableRecord = calculatePayableTickets(
          {
            rolloverTickets: rolloverTickets,
            rolloverRatio: rolloverRatio,
          },
          {
            totalTicketsUsed: totalStakes,
            totalFreeTickets: totalFree,
            totalTicketsBought: totalSold,
          },
        );

        await this.prisma.ticketRecords.update({
          where: { id: ticketRecord.id },
          data: {
            usedTickets: totalStakes,
            rolloverRatio: payableRecord.rolloverRatio * 1e6,
            rolloverTickets: payableRecord.rolloverTickets,
          },
        });

        await this.prisma.ticketRecords.create({
          data: {
            lastId: ticketRecord.id,
          },
        });

        const rewardData: RewardData[] = [];

        const remaining = new BigNumber(payableRecord.payableTickets)
          .multipliedBy(new BigNumber('98'))
          .div(new BigNumber('100'));

        for (const user of usersToReward) {
          const userProportion = new BigNumber(user.totalPoints).div(
            new BigNumber(totalPointsForPickedUsers),
          );
          const userEarnings = remaining.multipliedBy(userProportion);

          const roundedUserEarnings = userEarnings.decimalPlaces(
            3,
            BigNumber.ROUND_FLOOR,
          );

          if (userEarnings) {
            await this.prisma.reward.create({
              data: {
                userId: user.id,
                earning: roundedUserEarnings.toString(),
                points: user.totalPoints,
                sportTournamentId: tournament.id,
                claimed: 'DEFAULT',
                type: 'SPORT',
                totalTournamentPoints: totalPointsForPickedUsers,
              },
            });

            rewardData.push({
              addr: user.address,
              amount: Number(userEarnings.toString()) * env.hiro.ticketPrice,
            });
          }
        }

        allTxData.push({
          rewardData,
          totalTicketsUsed: payableRecord.payableTickets,
          totalNoOfPlayers: participatedUsers,
          tournamentId: tournament.id,
        });

        const sportBetIds = leaderboard.flatMap((user) =>
          user.sportBets.map((bet) => bet.id),
        );

        if (sportBetIds.length > 0) {
          await this.prisma.sportBet.updateMany({
            where: {
              id: { in: sportBetIds },
            },
            data: { disbursed: true },
          });
        }

        await this.prisma.sportTournament.update({
          where: { id: tournament.id },
          data: {
            totalStakes,
            paused: false,
            uniqueUsers: participatedUsers,
            numberOfUsersRewarded: { increment: usersToReward.length },
          },
        });
      });
    }

    for (const tx of allTxData) {
      await this.tournamentReward.storeTournamentRewards(tx, 2);
      await new Promise((resolve) => setTimeout(resolve, 3600));
    }

    currentTime = new Date(new Date().toUTCString());
    let currentTournament = await this.prisma.sportTournament.findFirst({
      where: {
        start: { lte: currentTime },
        end: { gte: currentTime },
      },
    });

    if (currentTournament && currentTournament.paused) {
      return;
    }

    if (!currentTournament) {
      const start = currentTime;
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 7);

      currentTournament = await this.prisma.sportTournament.create({
        data: { start, end },
      });
    }

    if (currentTournament) {
      const betsToTransfer = await this.prisma.sportBet.findMany({
        where: {
          disbursed: false,
          outcome: 'NOT_DECIDED',
          status: { in: ['NOT_STARTED', 'ONGOING'] },
        },
      });

      const totalStakesToTransfer = betsToTransfer.reduce(
        (acc, bet) => acc + bet.stake,
        0,
      );

      const uniqueUsersToTransfer = new Set(
        betsToTransfer.map((bet) => bet.userId),
      ).size;

      await this.prisma.sportBet.updateMany({
        where: {
          outcome: 'NOT_DECIDED',
          status: { in: ['NOT_STARTED', 'ONGOING'] },
        },
        data: {
          sportTournamentId: currentTournament.id,
          updatedAt: new Date(),
        },
      });

      await this.prisma.sportTournament.update({
        where: { id: currentTournament.id },
        data: {
          totalStakes: { increment: totalStakesToTransfer },
          uniqueUsers: { increment: uniqueUsersToTransfer },
        },
      });
    }
  }
}
