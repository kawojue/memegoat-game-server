import { Module } from '@nestjs/common'
import { WebhookService } from './webhook.service'
import { QueueModule } from 'src/queue/queue.module'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { WebhookController } from './webhook.controller'

@Module({
  imports: [QueueModule],
  controllers: [WebhookController],
  providers: [
    WebhookService,
    PrismaService,
    ResponseService,
  ],
  exports: [WebhookService]
})
export class WebhookModule { }
