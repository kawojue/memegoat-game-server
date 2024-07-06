import {
    IsArray, IsEnum, IsNotEmpty, Min,
    IsNumber, Max, ValidateIf, IsOptional
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export enum BetType {
    Single = 'single',
    Range = 'range',
    Color = 'color',
    OddEven = 'odd_even'
}

export enum Color {
    Red = 'red',
    Black = 'black'
}

export enum OddEven {
    Odd = 'odd',
    Even = 'even'
}

export class Bet {
    @ApiProperty({
        example: 'single',
        description: `The type of bet (single, range, color, or odd_even).`
    })
    @IsEnum(BetType)
    @IsNotEmpty()
    type: BetType

    @ApiProperty({
        example: 7,
        description: `The single number to bet on (0-36). Required if bet type is 'single'.`
    })
    @ValidateIf(o => o.type === BetType.Single)
    @Min(0)
    @Max(36)
    @IsNumber()
    @IsOptional()
    number?: number

    @ApiProperty({
        example: [1, 12],
        description: `The range of numbers to bet on (1-36). Required if bet type is 'range'.`
    })
    @ValidateIf(o => o.type === BetType.Range)
    @IsArray()
    @IsNumber({}, { each: true })
    @IsOptional()
    range?: number[]

    @ApiProperty({
        example: 'red',
        description: `The color to bet on (red or black). Required if bet type is 'color'.`
    })
    @ValidateIf(o => o.type === BetType.Color)
    @IsEnum(Color)
    @IsOptional()
    color?: Color

    @ApiProperty({
        example: 'odd',
        description: `Bet on odd or even numbers. Required if bet type is 'odd_even'.`
    })
    @ValidateIf(o => o.type === BetType.OddEven)
    @IsEnum(OddEven)
    @IsOptional()
    oddEven?: OddEven
}

export class CreateRouletteGameDTO {
    @ApiProperty({
        type: [Bet],
        description: `Array of bets placed by the player.`
    })
    @IsArray()
    @IsNotEmpty()
    bets: Bet[]

    @ApiProperty({
        example: 10,
        description: `The stake amount for the game.`
    })
    @Min(0)
    @IsNumber()
    @IsNotEmpty()
    stake: number
}
