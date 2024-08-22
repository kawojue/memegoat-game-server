import * as crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { env } from 'configs/env.config'
import * as seedrandom from 'seedrandom'
import { Injectable } from '@nestjs/common'

@Injectable()
export class RandomService {
    private algorithm: AlgoType

    constructor(algorithm: AlgoType) {
        this.algorithm = algorithm
    }

    private uuidv0x() {
        const value = new Uint8Array(16)
        crypto.getRandomValues(value)

        const timestamp = BigInt(Date.now())
        value[0] = Number((timestamp >> 40n) & 0xffn)
        value[1] = Number((timestamp >> 32n) & 0xffn)
        value[2] = Number((timestamp >> 24n) & 0xffn)
        value[3] = Number((timestamp >> 16n) & 0xffn)
        value[4] = Number((timestamp >> 8n) & 0xffn)
        value[5] = Number(timestamp & 0xffn)

        value[6] = (value[6] & 0x0f) | 0x70
        value[8] = (value[8] & 0x3f) | 0x80

        return Array.from(value)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
    }

    randomize() {
        const seed = this.hashSeed(`${env.genKey}-${this.uuidv0x()}-${uuidv4()}`)
        const random = seedrandom(seed)()
        return {
            random, seed,
            algo_type: this.algorithm,
        }
    }

    hashSeed(seed: string) {
        return crypto.createHash(this.algorithm).update(seed).digest('hex')
    }
}
