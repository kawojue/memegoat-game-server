import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsNumber, Min } from 'class-validator'

export class TH {
    @ApiProperty({
        example: 2
    })
    @Min(0)
    @IsNumber()
    heads: number

    @ApiProperty({
        example: 1
    })
    @Min(0)
    @IsNumber()
    tails: number
}

export class CreateCoinGameDTO extends TH {
    @ApiProperty({
        example: 12
    })
    @Min(0)
    @IsNumber()
    @IsNotEmpty()
    stake: number
}