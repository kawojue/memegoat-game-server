import * as crypto from 'crypto'
import * as seedrandom from 'seedrandom'
import { Injectable } from '@nestjs/common'
import { AlgoType, Coin } from '@prisma/client'

@Injectable()
export class RandomService {
    private readonly algorithm: AlgoType

    constructor(algorithm: AlgoType) {
        this.algorithm = algorithm
    }

    uuidv0x() {
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
        const newSeed = this.hashSeed(`${process.env.GEN_KEY}-${this.uuidv0x()}`)
        const random = seedrandom(newSeed)()
        return {
            random,
            seed: newSeed,
            algo_type: this.algorithm,
            result: random < 0.5 ? 'heads' : 'tails' as Coin,
        }
    }

    hashSeed(seed: string) {
        return crypto.createHash(this.algorithm).update(seed).digest('hex')
    }
}
