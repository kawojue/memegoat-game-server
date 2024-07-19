import { v4 as uuidv4 } from 'uuid'
import { Injectable } from '@nestjs/common'
import { PrismaService } from 'prisma/prisma.service'
import { Cron, CronExpression } from '@nestjs/schedule'

@Injectable()
export class TaskService {
    constructor(
        private readonly prisma: PrismaService,
    ) { }

    @Cron(CronExpression.EVERY_WEEK)
    async refreshTournament() {
        const key = uuidv4()
        const start = new Date()
        const end = new Date(start)
        end.setDate(start.getDate() + 7)

        await this.prisma.tournament.upsert({
            where: { key },
            create: { key, start, end },
            update: { start, end }
        })
    }
}