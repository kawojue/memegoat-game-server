import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common'
import {
  uintCV,
  AnchorMode,
  makeContractCall,
  TransactionVersion,
  standardPrincipalCV,
  FungibleConditionCode,
  makeStandardSTXPostCondition,
} from '@stacks/transactions'
import { Queue } from 'bullmq'
import { Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { env } from 'configs/env.config'
import { enc, HmacSHA256 } from 'crypto-js'
import { InjectQueue } from '@nestjs/bullmq'
import { MiscService } from 'libs/misc.service'
import { StatusCodes } from 'enums/StatusCodes'
import { avatarSeeds } from 'utils/avatar-seeds'
import { RandomService } from 'libs/random.service'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { ConnectWalletDTO, UsernameDTO } from './dto/auth.dto'
import { verifyMessageSignatureRsv } from '@stacks/encryption'
import { StacksMainnet, StacksTestnet } from '@stacks/network'
import { generateWallet, getStxAddress } from '@stacks/wallet-sdk'

const ranks = require('./ranks.json') as Rank[]

@Injectable()
export class AuthService {
  private randomService: RandomService
  private readonly avatarBaseUrl = 'https://api.dicebear.com/9.x/bottts/svg'
  private walletConfig: Record<
    HiroChannel,
    {
      txVersion: TransactionVersion
      network: StacksTestnet | StacksMainnet
    }
  > = {
      testnet: {
        txVersion: TransactionVersion.Testnet,
        network: new StacksTestnet(),
      },
      mainnet: {
        txVersion: TransactionVersion.Mainnet,
        network: new StacksMainnet(),
      },
    }

  constructor(
    private readonly misc: MiscService,
    private readonly prisma: PrismaService,
    private readonly response: ResponseService,
    @InjectQueue('reward-tx-queue') private rewardTxQueue: Queue,
  ) {
    this.randomService = new RandomService('md5')
  }

  private async verifySignature(receivedSignature: string, receivedTimestamp: string) {
    const clientSecret = env.auth.key
    const expectedSignature = HmacSHA256(receivedTimestamp, clientSecret)
    const encodedExpectedSignature = enc.Base64.stringify(expectedSignature)

    if (encodedExpectedSignature.trim() !== receivedSignature.trim()) {
      throw new Error('Invalid signature')
    }

    const currentTime = Date.now()
    const receivedTime = parseInt(receivedTimestamp, 10)
    const timeDifference = currentTime - receivedTime

    if (timeDifference > 300000) {
      throw new ForbiddenException('Timestamp is too old')
    }

    return true
  }

  private getLevelName(xp: number) {
    for (let i = 0; i < ranks.length; i++) {
      if (i === ranks.length - 1) {
        if (xp >= ranks[i].minXP) {
          return ranks[i].name
        }
      }
      else if (xp >= ranks[i].minXP && xp <= ranks[i].maxXP) {
        return ranks[i].name
      }
    }
    return 'Unknown Rank'
  }

  async connectWallet({
    address,
    signature,
    message,
    publicKey,
  }: ConnectWalletDTO) {
    let newUser = false
    const isVerified = verifyMessageSignatureRsv({
      message,
      publicKey,
      signature,
    })

    if (!isVerified) {
      throw new ForbiddenException('Signature is invalid')
    }

    let user = await this.prisma.user.findUnique({
      where: { address },
    })

    if (!user) {
      newUser = true
      const { random } = this.randomService.randomize()
      const randomAvatarSeed =
        avatarSeeds[Math.floor(random * avatarSeeds.length)]
      const avatarUrl = `${this.avatarBaseUrl}?seed=${randomAvatarSeed}`

      user = await this.prisma.user.create({
        data: {
          address,
          avatar: avatarUrl,
          stat: {
            create: { tickets: 100 },
          },
        },
      })
    }

    if (user) {
      if (!user.active) {
        throw new ForbiddenException('Account has been suspended')
      }
    }

    const parsedMessage = JSON.parse(message)

    const requestId = parsedMessage?.requestId
    const issuedAt = parsedMessage?.issuedAt

    const signatureVerified = await this.verifySignature(requestId, issuedAt)

    if (!signatureVerified) {
      throw new UnauthorizedException('Invalid Signature')
    }

    const access_token = await this.misc.generateAccessToken({
      sub: user.id,
      address: user.address,
    })

    return { access_token, user, newUser }
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
      })

      if (user) {
        return this.response.sendError(
          res,
          StatusCodes.Conflict,
          'Username has been taken',
        )
      }

      await this.prisma.user.update({
        where: { id: sub },
        data: { username },
      })

      this.response.sendSuccess(res, StatusCodes.OK, {
        data: { username },
        message: 'Username has been updated successfully',
      })
    } catch (err) {
      this.misc.handleServerError(res, err)
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
    })

    const newUser = {
      ...user,
      times_played: user._count.rounds,
      _count: undefined,
      levelName: this.getLevelName(user.stat.xp),
    }

    const gameTournament = await this.prisma.currentGameTournament()
    const sportTournament = await this.prisma.currentSportTournament()

    this.response.sendSuccess(res, StatusCodes.OK, {
      data: newUser,
      gameTournament,
      sportTournament,
    })
  }

  async reward(res: Response, { sub }: ExpressUser) {
    const isPendingReward = await this.prisma.reward.findFirst({
      where: {
        userId: sub,
        claimed: 'PENDING',
      }
    })

    const {
      _sum: { earning },
    } = await this.prisma.reward.aggregate({
      where: {
        userId: sub,
        claimed: 'DEFAULT',
      },
      _sum: { earning: true },
    })

    this.response.sendSuccess(res, StatusCodes.OK, {
      data: {
        reward: earning,
        isClaimable: earning.toNumber() > 0,
        status: isPendingReward ? 'PENDING' : 'DEFAULT',
        stxAmount: earning.toNumber() * 0.001, // Just an Assumption
      },
    })
  }

  async claimReward(res: Response, { sub }: ExpressUser) {
    const isPendingReward = await this.prisma.reward.findFirst({
      where: {
        userId: sub,
        claimed: 'PENDING',
      }
    })

    if (isPendingReward) {
      throw new BadRequestException("There is an ongoing transaction. Try again later..")
    }

    const {
      _sum: { earning },
    } = await this.prisma.reward.aggregate({
      where: {
        userId: sub,
        claimed: 'DEFAULT',
      },
      _sum: { earning: true },
    })

    const { address } = await this.prisma.user.findUnique({
      where: { id: sub },
    })

    const networkEnv = env.wallet.network
    if (!this.walletConfig[networkEnv]) {
      throw new Error(`Unknown network: ${networkEnv}`)
    }
    const wallet = await generateWallet({
      secretKey: env.wallet.key,
      password: env.wallet.password,
    })
    const account = wallet.accounts[0]
    const ticketPriceInSTX = 0.001 // 1 ticket = 1/1000 STX, example
    const postConditionAddress = getStxAddress({
      account,
      transactionVersion: this.walletConfig[networkEnv].txVersion,
    })
    const postConditionCode = FungibleConditionCode.LessEqual
    const postConditionAmount = earning.toNumber() * ticketPriceInSTX * 1e6
    const postConditions = [
      makeStandardSTXPostCondition(
        postConditionAddress,
        postConditionCode,
        postConditionAmount,
      ),
    ]
    const txOptions = {
      contractAddress: env.wallet.contract,
      contractName: 'memegoat-ticket-paymaster',
      functionName: 'payout-rewards',
      functionArgs: [standardPrincipalCV(address), uintCV(postConditionAmount)],
      senderKey: account.stxPrivateKey,
      validateWithAbi: true,
      network: this.walletConfig[networkEnv].network,
      postConditions,
      anchorMode: AnchorMode.Any,
    }
    const transaction = await makeContractCall(txOptions)

    await this.prisma.$transaction(async (tx) => {
      await tx.reward.updateMany({
        where: {
          userId: sub,
          claimed: 'DEFAULT',
        },
        data: { claimed: 'PENDING' },
      })

      await tx.transaction.create({
        data: {
          key: uuidv4(),
          txId: transaction.txid(),
          amount: postConditionAmount,
          tag: 'MEMEGOAT-GAMES',
          txSender: postConditionAddress,
          action: 'CLAIM-REWARD',
          user: { connect: { id: sub } }
        }
      })
    })

    await this.rewardTxQueue.add('reward-tx-queue', {
      sub,
      transaction,
      network: this.walletConfig[networkEnv].network
    })

    this.response.sendSuccess(res, StatusCodes.OK, {
      message: 'Successful',
      txId: transaction.txid(),
    })
  }
}
