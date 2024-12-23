import {
  UsernameDTO,
  BuyTicketDTO,
  ClaimRewardDTO,
  ConnectWalletDTO,
} from './dto/auth.dto';
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ranks } from './ranks';
import { Response } from 'express';
import { env } from 'configs/env.config';
import { enc, HmacSHA256 } from 'crypto-js';
import { ApiService } from 'libs/api.service';
import { StatusCodes } from 'enums/StatusCodes';
import { MiscService } from 'libs/misc.service';
import { avatarSeeds } from 'utils/avatar-seeds';
import { RandomService } from 'libs/random.service';
import { PrismaService } from 'prisma/prisma.service';
import { ResponseService } from 'libs/response.service';
import { Decimal } from '@prisma/client/runtime/library';
import { verifyMessageSignatureRsv } from '@stacks/encryption';
import type { Transaction } from '@stacks/stacks-blockchain-api-types';

@Injectable()
export class AuthService {
  private randomService: RandomService;
  private readonly avatarBaseUrl = 'https://api.dicebear.com/9.x/bottts/svg';

  constructor(
    private readonly api: ApiService,
    private readonly misc: MiscService,
    private readonly prisma: PrismaService,
    private readonly response: ResponseService,
  ) {
    this.randomService = new RandomService('md5');
  }

  private async verifySignature(
    receivedSignature: string,
    receivedTimestamp: string,
  ) {
    const clientSecret = env.auth.key;
    const expectedSignature = HmacSHA256(receivedTimestamp, clientSecret);
    const encodedExpectedSignature = enc.Base64.stringify(expectedSignature);

    if (encodedExpectedSignature.trim() !== receivedSignature.trim()) {
      throw new Error('Invalid signature');
    }

    const currentTime = Date.now();
    const receivedTime = parseInt(receivedTimestamp, 10);
    const timeDifference = currentTime - receivedTime;

    if (timeDifference > 300000) {
      throw new ForbiddenException('Timestamp is too old');
    }

    return true;
  }

  private getLevelName(xp: number): Rank {
    for (let i = 0; i < ranks.length; i++) {
      if (i === ranks.length - 1) {
        if (xp >= ranks[i].minXP) {
          return ranks[i];
        }
      } else if (xp >= ranks[i].minXP && xp <= ranks[i].maxXP) {
        return ranks[i];
      }
    }

    return {
      maxXP: 0,
      minXP: 0,
      name: 'Unknown Rank',
    };
  }

  async connectWallet({
    address,
    signature,
    message,
    publicKey,
  }: ConnectWalletDTO) {
    let newUser = false;
    const isVerified = verifyMessageSignatureRsv({
      message,
      publicKey,
      signature,
    });

    if (!isVerified) {
      throw new ForbiddenException('Signature is invalid');
    }

    let user = await this.prisma.user.findUnique({
      where: { address },
    });

    if (!user) {
      newUser = true;
      const { random } = this.randomService.randomize();
      const randomAvatarSeed =
        avatarSeeds[Math.floor(random * avatarSeeds.length)];
      const avatarUrl = `${this.avatarBaseUrl}?seed=${randomAvatarSeed}`;

      user = await this.prisma.user.create({
        data: {
          address,
          avatar: avatarUrl,
          stat: {
            create: {},
          },
        },
      });
    }

    if (user) {
      if (!user.active) {
        throw new ForbiddenException('Account has been suspended');
      }
    }

    const parsedMessage = JSON.parse(message);

    const requestId = parsedMessage?.requestId;
    const issuedAt = parsedMessage?.issuedAt;

    const signatureVerified = await this.verifySignature(requestId, issuedAt);

    if (!signatureVerified) {
      throw new UnauthorizedException('Invalid Signature');
    }

    const access_token = await this.misc.generateAccessToken({
      sub: user.id,
      address: user.address,
    });

    return { access_token, user, newUser };
  }

  async editUsername(
    res: Response,
    { sub }: ExpressUser,
    { username }: UsernameDTO,
  ) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          username: { equals: username, mode: 'insensitive' },
        },
      });

      if (user) {
        return this.response.sendError(
          res,
          StatusCodes.Conflict,
          'Username has been taken',
        );
      }

      await this.prisma.user.update({
        where: { id: sub },
        data: { username },
      });

      this.response.sendSuccess(res, StatusCodes.OK, {
        data: { username },
        message: 'Username has been updated successfully',
      });
    } catch (err) {
      this.misc.handleServerError(res, err);
    }
  }

  async profile(res: Response, { sub }: ExpressUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: sub },
      include: {
        stat: true,
      },
    });

    const totalBets = await this.prisma.sportBet.aggregate({
      where: { userId: sub },
      _sum: {
        stake: true,
      },
      _count: {
        _all: true,
      },
    });

    const totalGameRounds = await this.prisma.round.aggregate({
      where: { userId: sub },
      _sum: {
        stake: true,
      },
      _count: {
        _all: true,
      },
    });

    const totalTicketStakes = totalBets._sum.stake + totalGameRounds._sum.stake;
    const timesPlayed = totalBets._count._all + totalGameRounds._count._all;

    this.response.sendSuccess(res, StatusCodes.OK, {
      data: {
        ...user,
        timesPlayed,
        totalTicketStakes,
        experience: this.getLevelName(user.stat.xp),
        totalSTXStaked: this.misc.getStxAmount(totalTicketStakes),
      },
    });
  }

  async tournamentStatS() {
    let currentGameTournament = await this.prisma.currentGameTournament();
    let currentSportTournament = await this.prisma.currentSportTournament();

    let totalGameStakes = 0;
    let totalSportStakes = 0;

    if (currentGameTournament) {
      const stakes = await this.prisma.round.aggregate({
        where: { gameTournamentId: currentGameTournament.id },
        _sum: { stake: true },
      });

      totalGameStakes = stakes._sum?.stake;
    }

    if (currentSportTournament) {
      const stakes = await this.prisma.sportBet.aggregate({
        where: { sportTournamentId: currentSportTournament.id },
        _sum: { stake: true },
      });

      totalSportStakes = stakes._sum.stake;
    }

    const gameTournament = {
      ...currentGameTournament,
      totalStakes: undefined,
      totalTicketStakes: totalGameStakes,
      stxAmount: this.misc.getStxAmount(totalGameStakes),
    };

    const sportTournament = {
      ...currentSportTournament,
      totalTicketStakes: totalSportStakes,
      stxAmount: this.misc.getStxAmount(totalSportStakes),
    };

    return { gameTournament, sportTournament };
  }

  async reward(res: Response, { sub }: ExpressUser) {
    const rewards = await this.prisma.reward.findMany({
      where: {
        userId: sub,
      },
      include: {
        gameTournament: {
          select: {
            bId: true,
          },
        },
        sportTournament: {
          select: {
            bId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rewardsData = rewards.map((reward) => {
      const rewardAmount = reward.earning ?? new Decimal(0);
      const bId =
        reward.gameTournament?.bId ?? reward.sportTournament?.bId ?? null;
      const category = reward.gameTournament
        ? 'Games'
        : reward.sportTournament
          ? 'Sports'
          : 'Uncategorized';
      return {
        rewardAmount,
        rewardId: reward.id,
        isClaimable: reward.claimable,
        status: reward.claimed,
        stxAmount: this.misc.getStxAmount(rewardAmount.toNumber()),
        bId,
        category,
      };
    });

    this.response.sendSuccess(res, StatusCodes.OK, {
      data: rewardsData,
    });
  }

  async claimReward({ sub }: ExpressUser, { txId, rewardId }: ClaimRewardDTO) {
    const isPendingReward = await this.prisma.reward.findFirst({
      where: {
        id: rewardId,
        userId: sub,
        claimed: 'PENDING',
      },
    });

    if (isPendingReward) {
      throw new BadRequestException(
        'There is an ongoing transaction. Try again later..',
      );
    }

    const { address } = await this.prisma.user.findUnique({
      where: { id: sub },
    });

    await this.prisma.reward.update({
      where: {
        id: rewardId,
        userId: sub,
      },
      data: { claimed: 'PENDING' },
    });

    return await this.prisma.transaction.create({
      data: {
        txId: txId,
        key: rewardId,
        txSender: address,
        tag: 'CLAIM-REWARDS',
        user: { connect: { id: sub } },
      },
    });
  }

  async buyTicket({ sub }: ExpressUser, { txId }: BuyTicketDTO) {
    const data = await this.api.fetchTransaction<Transaction>(
      env.hiro.channel,
      txId,
    );

    if (!data) {
      throw new NotFoundException('Transaction not found');
    }

    return await this.prisma.transaction.create({
      data: {
        txId: data.tx_id,
        tag: 'BUY-TICKETS',
        txStatus: 'Pending',
        txSender: data.sender_address,
        action: 'NEW-TICKET-BOUGHT-MEMEGOAT-GAMES',
        user: { connect: { id: sub } },
      },
    });
  }

  async burnGoat({ sub }: ExpressUser, { txId }: BuyTicketDTO) {
    const [currentGameTournament, currentSportTournament] = await Promise.all([
      this.prisma.currentGameTournament(),
      this.prisma.currentSportTournament(),
    ]);

    if (!currentGameTournament && !currentSportTournament) {
      throw new NotFoundException('No active tournament found');
    }

    const userStat = await this.prisma.stat.findUnique({
      where: { userId: sub },
    });

    if (
      userStat.lastGoatBurntAt &&
      ((currentGameTournament &&
        userStat.lastGoatBurntAt >= currentGameTournament.start) ||
        (currentSportTournament &&
          userStat.lastGoatBurntAt >= currentSportTournament.start))
    ) {
      throw new BadRequestException(
        'You have already burned a goat in this tournament session',
      );
    }

    const data = await this.api.fetchTransaction<Transaction>(
      env.hiro.channel,
      txId,
    );

    if (!data) {
      throw new NotFoundException('Transaction not found');
    }

    await this.prisma.stat.update({
      where: { userId: sub },
      data: { lastGoatBurntAt: new Date() },
    });

    return await this.prisma.transaction.create({
      data: {
        txId: data.tx_id,
        tag: 'BURN-GOAT',
        txSender: data.sender_address,
        user: { connect: { id: sub } },
      },
    });
  }
}
