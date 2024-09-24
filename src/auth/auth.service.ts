import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  UnprocessableEntityException,
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
import { ranks } from './ranks'
import { Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { env } from 'configs/env.config'
import { enc, HmacSHA256 } from 'crypto-js'
import { InjectQueue } from '@nestjs/bullmq'
import { ApiService } from 'libs/api.service'
import { StatusCodes } from 'enums/StatusCodes'
import { MiscService } from 'libs/misc.service'
import { avatarSeeds } from 'utils/avatar-seeds'
import { RandomService } from 'libs/random.service'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { Decimal } from '@prisma/client/runtime/library'
import { verifyMessageSignatureRsv } from '@stacks/encryption'
import { StacksMainnet, StacksTestnet } from '@stacks/network'
import { generateWallet, getStxAddress } from '@stacks/wallet-sdk'
import type { Transaction } from '@stacks/stacks-blockchain-api-types'
import { BuyTicketDTO, ConnectWalletDTO, UsernameDTO } from './dto/auth.dto'

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
    private readonly api: ApiService,
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

  private getStxAmount(ticket: number) {
    return ticket * 0.001 // 1 STX = 1,000 tickets
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
      },
    })

    const totalBets = await this.prisma.sportBet.aggregate({
      _sum: {
        stake: true
      },
      _count: {
        _all: true
      }
    })

    const totalGameRounds = await this.prisma.round.aggregate({
      _sum: {
        stake: true
      },
      _count: {
        _all: true
      }
    })

    const totalTicketStakes = totalBets._sum.stake + totalGameRounds._sum.stake
    const timesPlayed = totalBets._count._all + totalGameRounds._count._all

    this.response.sendSuccess(res, StatusCodes.OK, {
      data: {
        ...user,
        timesPlayed,
        totalTicketStakes,
        levelName: this.getLevelName(user.stat.xp),
        totalSTXStaked: this.getStxAmount(totalTicketStakes),
      },
    })
  }

  async tournamentStat(res: Response) {
    let gameTournament = await this.prisma.currentGameTournament() as any
    let sportTournament = await this.prisma.currentSportTournament() as any

    gameTournament = {
      ...gameTournament,
      stxAmount: this.getStxAmount(gameTournament.totalStakes),
      usdAmount: this.getStxAmount(gameTournament.totalStakes) * 0
    }

    sportTournament = {
      ...sportTournament,
      stxAmount: this.getStxAmount(sportTournament.totalStakes),
      usdAmount: this.getStxAmount(sportTournament.totalStakes) * 0
    }

    this.response.sendSuccess(res, StatusCodes.OK, { gameTournament, sportTournament })
  }

  async reward(res: Response, { sub }: ExpressUser) {
    const hasOngoingReward = await this.prisma.reward.findFirst({
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

    const reward = earning ?? new Decimal(0)

    this.response.sendSuccess(res, StatusCodes.OK, {
      data: {
        reward,
        isClaimable: reward.toNumber() > 0,
        status: hasOngoingReward ? 'PENDING' : 'DEFAULT',
        stxAmount: this.getStxAmount(reward.toNumber()),
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
      _sum: { earning: reward },
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

    const earning = reward ?? new Decimal(0)

    const networkEnv = env.wallet.network
    if (!this.walletConfig[networkEnv]) {
      throw new Error(`Unknown network: ${networkEnv}`)
    }
    const wallet = await generateWallet({
      secretKey: env.wallet.key,
      password: env.wallet.password,
    })
    const account = wallet.accounts[0]
    const postConditionAddress = getStxAddress({
      account,
      transactionVersion: this.walletConfig[networkEnv].txVersion,
    })

    const postConditionCode = FungibleConditionCode.LessEqual
    const postConditionAmount = this.getStxAmount(earning.toNumber()) * 1e6
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

  async buyTicket(
    { sub }: ExpressUser,
    { txId }: BuyTicketDTO,
  ) {
    const data = await this.api.fetchTransaction<Transaction>(env.hiro.channel, txId)

    return await this.prisma.transaction.create({
      data: {
        txId: data.tx_id,
        tag: 'BUY-TICKETS',
        txStatus: 'Pending',
        txSender: data.sender_address,
        action: 'NEW-TICKET-BOUGHT-MEMEGOAT-GAMES',
        user: { connect: { id: sub } }
      }
    })
  }
}
