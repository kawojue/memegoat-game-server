import {
    IsArray, IsNotEmpty, IsNumber, Max, Min
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class Dice {
    @ApiProperty({
        example: 1,
        description: `The size of the dice (1 or 2).`
    })
    @Min(1)
    @Max(2)
    @IsNumber()
    @IsNotEmpty()
    size: 1 | 2

    @ApiProperty({
        example: [6],
        description: `Array of guesses for the dice rolls.`
    })
    @IsArray()
    @IsNumber({}, { each: true })
    @IsNotEmpty()
    guesses: number[]
}

export class CreateDiceGameDTO extends Dice {
    @ApiProperty({
        example: 12,
        description: `The stake amount for the game.`
    })
    @Min(0)
    @IsNumber()
    @IsNotEmpty()
    stake: number
}
