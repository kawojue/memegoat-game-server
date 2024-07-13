import { GameType } from '@prisma/client'
import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, Min } from 'class-validator'

export class CanStakeDTO {
    @ApiProperty({
        enum: GameType
    })
    @Min(0)
    @IsNumber()
    stake: number
}