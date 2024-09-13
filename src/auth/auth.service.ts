import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { env } from 'configs/env.config';
import { enc, HmacSHA256 } from 'crypto-js';
import { MiscService } from 'libs/misc.service';
import { StatusCodes } from 'enums/StatusCodes';
import { avatarSeeds } from 'utils/avatar-seeds';
import { RandomService } from 'libs/random.service';
import { PrismaService } from 'prisma/prisma.service';
import { ResponseService } from 'libs/response.service';
import { ConnectWalletDTO, UsernameDTO } from './dto/auth.dto';
import { verifyMessageSignatureRsv } from '@stacks/encryption';

@Injectable()
export class AuthService {
  private randomService: RandomService;
  private readonly avatarBaseUrl = 'https://api.dicebear.com/9.x/bottts/svg';

  constructor(
    private readonly misc: MiscService,
    private readonly prisma: PrismaService,
    private readonly response: ResponseService,
  ) {
    this.randomService = new RandomService('md5');
  }

  async verifySignature(receivedSignature: string, receivedTimestamp: string) {
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

  async connectWallet({
    address,
    signature,
    message,
    publicKey,
  }: ConnectWalletDTO) {
    try {
      let newUser = false
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
        newUser = true
        const { random } = this.randomService.randomize();
        const randomAvatarSeed =
          avatarSeeds[Math.floor(random * avatarSeeds.length)];
        const avatarUrl = `${this.avatarBaseUrl}?seed=${randomAvatarSeed}`;

        user = await this.prisma.user.create({
          data: {
            address, avatar: avatarUrl,
            stat: {
              create: { tickets: 100 }
            }
          },
        })
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
    } catch (err) {
      throw err;
    }
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
        _count: {
          select: {
            rounds: true,
          },
        },
      },
    });

    const newUser = {
      ...user,
      times_played: user._count.rounds,
      _count: undefined,
    };

    this.response.sendSuccess(res, StatusCodes.OK, { data: newUser });
  }
}
