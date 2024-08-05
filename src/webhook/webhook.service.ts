import { Request } from 'express';
import { TxStatus } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { RealtimeService } from 'src/realtime/realtime.service';

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  private processing = false;
  private requestQueue: Request[] = [];

  async enqueueRequest(req: Request) {
    this.requestQueue.push(req);
    this.processQueue();
  }

  private async processQueue() {
    if (this.processing) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const req = this.requestQueue.shift();
      if (req) {
        await this.handleEvent(req);
      }
    }

    this.processing = false;
  }

  async handleEvent(req: Request) {
    const data = req.body.data;

    const payload = {
      key: data.key,
      tag: data.tag,
      txID: data.txID,
      amount: data.amount,
      txSender: data.txSender,
      action: data.action,
      txStatus: data.txStatus as TxStatus,
    };

    await this.prisma.transaction.upsert({
      where: { txID: data.txID },
      create: payload,
      update: payload,
    });

    await this.realtimeService.fetchRecentTransactions();
  }
}
