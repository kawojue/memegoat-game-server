import { Queue } from 'bullmq';
import { subDays } from 'date-fns';
import { TxStatus } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Request, Response } from 'express';
import { FetchTxDTO } from './dto/index.dto';
import { StatusCodes } from 'enums/StatusCodes';
import { PrismaService } from 'prisma/prisma.service';
import { ResponseService } from 'libs/response.service';

export interface WhTxPayload {
  key: any;
  tag: any;
  txId: any;
  amount: any;
  txSender: any;
  action: any;
  txStatus: TxStatus;
}

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly response: ResponseService,
    @InjectQueue('transactions-queue') private readonly transactionQueue: Queue,
  ) {}

  private processing = false;
  private requestQueue: Request[] = [];

  async enqueueRequest(res: Response, req: Request) {
    this.requestQueue.push(req);
    this.processQueue(res);
  }

  private async processQueue(res: Response) {
    if (this.processing) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const req = this.requestQueue.shift();
      if (req) {
        await this.handleEvent(res, req);
      }
    }

    this.processing = false;
  }

  async handleEvent(res: Response, req: Request) {
    switch (req.body.event) {
      case 'transaction':
        const data = req.body.data;

        const payload = {
          key: data.key,
          tag: data.tag,
          txId: data.txId,
          amount: data.amount,
          txSender: data.txSender,
          action: data.action,
          txStatus: data.txStatus as TxStatus,
        } as WhTxPayload;

        await this.transactionQueue.add('wh.transaction', { payload });
        break;
      default:
        return this.response.sendError(
          res,
          StatusCodes.Unauthorized,
          'Unsupported Event',
        );
    }
  }

  async fetchRecentTransactions({ status, tag, address }: FetchTxDTO) {
    const thirtyDaysAgo = subDays(new Date(), 30);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        updatedAt: {
          gte: thirtyDaysAgo,
        },
        txStatus: status ? status : undefined,
        tag: tag ? { equals: tag, mode: 'insensitive' } : undefined,
        txSender: address
          ? { equals: address, mode: 'insensitive' }
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
    });

    return transactions;
  }

  async countUniqueAddresses(): Promise<number> {
    const uniqueAddresses = await this.prisma.transaction.groupBy({
      by: ['txSender'],
    });
    return uniqueAddresses.length;
  }

  async getTransactionCount(): Promise<number> {
    const count = await this.prisma.transaction.count();
    return count;
  }
}
