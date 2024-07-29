import { Module } from '@nestjs/common'
import { WebhookService } from './webhook.service'
import { PrismaService } from 'prisma/prisma.service'
import { WebhookController } from './webhook.controller'
import { RealtimeModule } from 'src/realtime/realtime.module'

@Module({
  imports: [RealtimeModule],
  controllers: [WebhookController],
  providers: [
    WebhookService,
    PrismaService,
  ],
  exports: [WebhookService]
})
export class WebhookModule { }
