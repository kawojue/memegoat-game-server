import {
  Req,
  Res,
  Get,
  Post,
  Query,
  Controller,
  HttpException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { env } from 'configs/env.config';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { FetchTxDTO } from './dto/index.dto';
import { StatusCodes } from 'enums/StatusCodes';
import { WebhookService } from './webhook.service';
import { ResponseService } from 'libs/response.service';

@ApiTags('Webhook')
@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly response: ResponseService,
    private readonly webhookService: WebhookService,
  ) {}

  @Post()
  async receiveWebhook(@Res() res: Response, @Req() req: Request) {
    if (!req.body || !req.body?.event || !req.body?.data) {
      throw new HttpException(
        'Invalid request body received',
        StatusCodes.BadRequest,
      );
    }

    const signature = req.headers['x-webhook-signature'];
    const txId = req.body?.data.txId;
    const hashedSignature = crypto
      .createHmac('sha512', env.webhook.secret)
      .update(txId)
      .digest('hex');

    if (signature !== hashedSignature) {
      throw new HttpException(
        'Invalid signature received',
        StatusCodes.Unauthorized,
      );
    }

    try {
      await this.webhookService.enqueueRequest(res, req);
      return res.sendStatus(StatusCodes.OK).end();
    } catch (err) {
      console.error(err);
      throw new HttpException(
        'Internal server error',
        StatusCodes.InternalServerError,
      );
    }
  }

  @Get('transactions')
  async fetchTransactions(@Res() res: Response, @Query() body: FetchTxDTO) {
    const transactions =
      await this.webhookService.fetchRecentTransactions(body);
    return this.response.sendSuccess(res, StatusCodes.OK, {
      data: transactions,
    });
  }

  @Get('uniqueAddresses')
  async fetchUniqueAddresses(@Res() res: Response) {
    const uniqueAddresses = await this.webhookService.countUniqueAddresses();
    return this.response.sendSuccess(res, StatusCodes.OK, {
      data: uniqueAddresses,
    });
  }

  @Get('transactionCount')
  async fetchTransactionCount(@Res() res: Response) {
    const txCount = await this.webhookService.getTransactionCount();
    return this.response.sendSuccess(res, StatusCodes.OK, { data: txCount });
  }
}
