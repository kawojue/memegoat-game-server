import { subDays } from 'date-fns'
import { TxStatus } from '@prisma/client'
import { Injectable } from '@nestjs/common'
import { Request, Response } from 'express'
import { FetchTxDTO } from './dto/index.dto'
import { StatusCodes } from 'enums/StatusCodes'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly response: ResponseService,
  ) { }

  private processing = false
  private requestQueue: Request[] = []

  async enqueueRequest(res: Response, req: Request) {
    this.requestQueue.push(req)
    this.processQueue(res)
  }

  private async processQueue(res: Response) {
    if (this.processing) {
      return
    }

    this.processing = true

    while (this.requestQueue.length > 0) {
      const req = this.requestQueue.shift()
      if (req) {
        await this.handleEvent(res, req)
      }
    }

    this.processing = false
  }

  async handleEvent(res: Response, req: Request) {
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
        return this.response.sendError(res, StatusCodes.Unauthorized, "Unsupported Event")
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
