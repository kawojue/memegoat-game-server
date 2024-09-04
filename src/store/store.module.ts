import { Module } from '@nestjs/common'
import { env } from 'configs/env.config'
import { StoreService } from './store.service'
import { redisStore } from 'cache-manager-redis-store'
import { CacheModule, CacheStore } from '@nestjs/cache-manager'

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => {
        const store = await redisStore({
          ...(env.redis.username && {
            password: env.redis.password,
            username: env.redis.username,
          }),
          socket: {
            host: env.redis.host,
            port: env.redis.port,
          },
        })

        return {
          max: Infinity,
          store: store as unknown as CacheStore,
          ttl: 7 * 24 * 60 * 60 * 1000,
        }
      },
    }),
  ],
  providers: [StoreService],
  exports: [StoreService],
})
export class StoreModule { }