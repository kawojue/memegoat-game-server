import { Coin } from '@prisma/client'
import { ApiProperty } from '@nestjs/swagger'
import {
    IsArray, IsEnum, IsNotEmpty, IsNumber, Min
} from 'class-validator'

export class CreateRoundDTO {
    @ApiProperty({
        enum: Coin
    })
    @IsEnum(Coin)
    guess: Coin
}

export class CoinFlipRoundDTO {
    @ApiProperty({
        example: [
            { guess: 'heads' },
            { guess: 'tails' },
        ]
    })
    @IsArray()
    rounds: CreateRoundDTO[]
}

export class CreateCoinGameDTO extends CoinFlipRoundDTO {
    @ApiProperty({
        example: 12
    })
    @Min(0)
    @IsNumber()
    @IsNotEmpty()
    stake: number
}