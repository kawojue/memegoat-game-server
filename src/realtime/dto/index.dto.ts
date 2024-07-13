import { IsRouletteBetValue } from './custom-validators'
import { IsArray, IsEnum, IsNotEmpty, IsNumber, Max, Min } from 'class-validator'

enum CoinFlip {
    tails = 'tails',
    heads = 'heads',
}

enum RouletteBetType {
    single = 'single',
    red = 'red',
    black = 'black',
    odd = 'odd',
    even = 'even',
}

type RouletteBetValue = number | 'red' | 'black' | 'odd' | 'even'

class StakeDTO {
    @Min(0)
    @IsNumber()
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
    @IsEnum(RouletteBetType)
    betType: RouletteBetType

    @IsRouletteBetValue({ message: 'Invalid bet value for the given bet type' })
    betValue: RouletteBetValue
}
