import {
    Min,
    Max,
    IsIn,
    IsInt,
    IsEnum,
    IsArray,
    IsNumber,
    IsNotEmpty,
    IsOptional,
    Matches,
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

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
    @IsOptional()
    number: number
}

export class StartBlackjackDTO {
    userId: string
}

export class GameIdDTO {
    gameId: string
}

export class StartBlindBoxGameDTO {
    tickets: number
}

export class SelectBoxDTO {
    row: number
    column: number
}

export class LotteryDTO extends StakeDTO {
    @ApiProperty({
        example: '123456'
    })
    @Max(6)
    @Min(6)
    @Matches(/^\d+$/, {
        message: 'Lottery must be a digit'
    })
    digits: string
}

export class StartSpaceInvaderDTO {
    @IsInt()
    lives: number
}

export class EndSpaceInvaderDTO {
    @IsInt()
    points: number
}