import { Request } from 'express'
import { subDays } from 'date-fns'
import { TxStatus } from '@prisma/client'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { FetchTxDTO } from './dto/index.dto'
import { PrismaService } from 'prisma/prisma.service'

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
  ) { }

  private processing = false
  private requestQueue: Request[] = []

  async enqueueRequest(req: Request) {
    this.requestQueue.push(req)
    this.processQueue()
  }

  private async processQueue() {
    if (this.processing) {
      return
    }

    this.processing = true

    while (this.requestQueue.length > 0) {
      const req = this.requestQueue.shift()
      if (req) {
        await this.handleEvent(req)
      }
    }

    this.processing = false
  }

  async handleEvent(req: Request) {
    switch (req.body.event) {
      case 'transaction':
        const data = req.body.data

        const payload = {
          key: data.key,
          tag: data.tag,
          txId: data.txId,
          amount: data.amount,
          txSender: data.txSender,
          action: data.action,
          txStatus: data.txStatus as TxStatus,
        }

        await this.prisma.transaction.upsert({
          where: { txId: data.txId },
          create: payload,
          update: payload,
        })
      default:
        throw new UnauthorizedException("Unsupported Event")
    }
  }


  async fetchRecentTransactions({ status, tag, address }: FetchTxDTO) {
    const thirtyDaysAgo = subDays(new Date(), 30)

    const whereClause: any = {
      updatedAt: {
        gte: thirtyDaysAgo,
      },
    }

    if (status) {
      whereClause.status = status
    }

    if (tag || address) {
      whereClause.OR = []

      if (tag) {
        whereClause.OR.push({ tag: { equals: tag, mode: 'insensitive' } })
      }

      if (address) {
        whereClause.OR.push({ txSender: { equals: address, mode: 'insensitive' } })
      }
    }

    const transactions = await this.prisma.transaction.findMany({
      where: whereClause,
    })

    return transactions
  }
}
