import {
    IsArray, IsNotEmpty, IsNumber, Max, Min
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class DiceRoundDTO {
    @ApiProperty({
        example: [
            {
                numDice: 1,
                guess: [6],
            },
            {
                numDice: 2,
                guess: [6, 6],
            },
            {
                numDice: 1,
                guess: [5],
            },
        ]
    })
    @IsArray()
    rounds: DiceRound[]
}

export class CreateDiceGameDTO extends DiceRoundDTO {
    @ApiProperty({
        example: 12
    })
    @Min(0)
    @IsNumber()
    @IsNotEmpty()
    stake: number
}

export class DiceRound {
    @ApiProperty({
        example: 2,
        description: `Either 1 or 2 Dice`
    })
    @Min(1)
    @Max(2)
    @IsNumber()
    numDice: 1 | 2

    @ApiProperty({
        example: [2, 3]
    })
    @IsArray()
    @IsNumber({}, { each: true })
    guess: number[]
}
