import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { BullModule } from '@nestjs/bullmq'
import { ApiService } from 'libs/api.service'
import { StoreModule } from 'src/store/store.module'
import { PrismaService } from 'prisma/prisma.service'
import { ContractService } from 'libs/contract.service'
import { TransactionsQueueProcessor } from './transactions.processor'
import { FootballSportsQueueProcessor } from './football-sport.processor'

const SharedModule = BullModule.registerQueue(
  {
    name: 'sports-football-queue',
    defaultJobOptions: {
      removeOnFail: true,
      removeOnComplete: true,
    }
  },
  {
    name: 'sports-nfl-queue',
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
  {
    name: 'current-tournament-queue',
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
    PrismaService,
    ContractService,
    TransactionsQueueProcessor,
    FootballSportsQueueProcessor,
  ],
  exports: [SharedModule]
})
export class QueueModule { }
