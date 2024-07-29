import {
  Req,
  Post,
  Controller,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common'
import * as crypto from 'crypto'
import { Request } from 'express'
import { ApiTags } from '@nestjs/swagger'
import { WebhookService } from './webhook.service'

@ApiTags("Webhook")
@Controller('webhook')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) { }

  @Post()
  async receiveWebhook(@Req() req: Request) {
    if (!req.body || !req.body?.event || !req.body?.data) {
      throw new BadRequestException('Invalid request body received')
    }

    const signature = req.headers['x-webhook-signature']
    const hashedSignature = crypto.createHmac('sha512', process.env.WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex')

    if (signature !== hashedSignature) {
      throw new UnauthorizedException("Invalid signature received")
    }

    try {
      await this.webhookService.enqueueRequest(req)
    } catch (err) {
      console.error(err)
      throw new InternalServerErrorException()
    }
  }
}
