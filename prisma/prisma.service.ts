
import { PrismaClient, Prisma } from '@prisma/client'
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    async onModuleInit() {
        await this.$connect()
    }

    async onModuleDestroy() {
        await this.$disconnect()
    }

    isDeadlockError(error: any): boolean {
        return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
    }

    async retryTransaction(fn: () => Promise<void>, retries = 5) {
        for (let i = 0; i < retries; i++) {
            try {
                await fn()
                break
            } catch (error) {
                if (i === retries - 1 || !this.isDeadlockError(error)) {
                    throw error
                }
                await new Promise(resolve => setTimeout(resolve, 100))
            }
        }
    }
}