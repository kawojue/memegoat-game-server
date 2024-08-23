import { Cache } from 'cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'

@Injectable()
export class StoreService {
    constructor(@Inject(CACHE_MANAGER) private cache: Cache) { }

    async get<T>(key: string) {
        return await this.cache.get<T>(key)
    }

    async set<T>(key: string, value: T, ttl?: number) {
        await this.cache.set(key, value, ttl)
    }

    async delete(key: string) {
        await this.cache.del(key)
    }
}
