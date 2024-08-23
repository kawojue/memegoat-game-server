import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { HttpModule } from '@nestjs/axios'
import { ApiService } from 'libs/api.service'
import { TaskService } from 'libs/task.service'
import { StoreModule } from 'src/store/store.module'
import { PrismaService } from 'prisma/prisma.service'
import { SportsQueueProcessor } from './sports.processor'
import { TransactionsQueueProcessor } from './transactions.processor'

const SharedModule = BullModule.registerQueue(
  {
    name: 'sports-queue',
    defaultJobOptions: {
      removeOnFail: true,
      removeOnComplete: true,
    }
  },
  {
    name: 'transactions-queue',
    defaultJobOptions: {
      removeOnFail: true,
      removeOnComplete: true,
    }
  },
)

@Module({
  imports: [
    HttpModule,
    StoreModule,
    SharedModule,
  ],
  providers: [
    ApiService,
    TaskService,
    PrismaService,
    SportsQueueProcessor,
    TransactionsQueueProcessor,
  ],
  exports: [SharedModule]
})
export class QueueModule { }
