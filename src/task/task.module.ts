import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { TaskService } from './task.service'
import { QueueModule } from 'src/queue/queue.module'
import { PrismaService } from 'prisma/prisma.service'
import { ContractService } from 'libs/contract.service'
import { TournamentService } from 'libs/tournament.service'

@Module({
    imports: [QueueModule, HttpModule],
    providers: [
        TaskService,
        PrismaService,
        ContractService,
        TournamentService,
    ],
    exports: [TaskService]
})
export class TaskModule { }
