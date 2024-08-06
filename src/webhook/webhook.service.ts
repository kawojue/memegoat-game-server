import { Request } from 'express'
import { subDays } from 'date-fns'
import { TxStatus } from '@prisma/client'
import { Injectable } from '@nestjs/common'
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
    const data = req.body.data

    const payload = {
      key: data.key,
      tag: data.tag,
      txID: data.txID,
      amount: data.amount,
      txSender: data.txSender,
      action: data.action,
      txStatus: data.txStatus as TxStatus,
    }

    await this.prisma.transaction.upsert({
      where: { txID: data.txID },
      create: payload,
      update: payload,
    })
  }


  async fetchRecentTransactions({ address, status, tag }: FetchTxDTO) {
    const thirtyDaysAgo = subDays(new Date(), 30)

    const transactions = await this.prisma.transaction.findMany({
      where: {
        txStatus: status || undefined,
        OR: [
          { tag: { equals: tag, mode: 'insensitive' } },
          { address: { contains: address, mode: 'insensitive' } }
        ],
        updatedAt: {
          gte: thirtyDaysAgo
        }
      }
    })

    return transactions
  }
}
