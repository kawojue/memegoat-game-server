import {
    Min,
    Max,
    IsIn,
    IsInt,
    IsEnum,
    IsArray,
    IsNumber,
    IsNotEmpty,
} from 'class-validator'

enum CoinFlip {
    tails = 'tails',
    heads = 'heads',
}

class StakeDTO {
    @Min(0)
    @IsInt()
    stake: number
}

export class CoinFlipDTO extends StakeDTO {
    @IsNotEmpty()
    @IsEnum(CoinFlip)
    guess: CoinFlip
}

export class DiceDTO extends StakeDTO {
    @Min(1)
    @Max(5)
    @IsNumber()
    numDice: number

    @IsArray()
    guesses: number[]
}

export class RouletteDTO extends StakeDTO {
    @IsIn(['number', 'color', 'parity'], {
        message: 'betType must be one of the following: number, color, parity',
    })
    betType: 'number' | 'color' | 'parity'

    @IsInt()
    @Min(0)
    @Max(36)
    number: number
}
