import * as crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import * as seedrandom from 'seedrandom'
import { Injectable } from '@nestjs/common'
import { AlgoType, Coin } from '@prisma/client'

@Injectable()
export class FlipperService {
    private readonly algorithm: AlgoType

    constructor(algorithm: AlgoType) {
        this.algorithm = algorithm
    }

    flipCoin() {
        const newSeed = this.hashSeed(`${process.env.GEN_KEY}-${uuidv4()}-${Date.now()}`)
        const random = seedrandom(newSeed)
        return {
            seed: newSeed,
            algo_type: this.algorithm,
            result: random() < 0.5 ? 'heads' : 'tails' as Coin,
        }
    }

    hashSeed(seed: string) {
        return crypto.createHash(this.algorithm).update(seed).digest('hex')
    }
}
