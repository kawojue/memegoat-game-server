import { IsEnum, IsNotEmpty, IsNumber, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export enum Move {
    Rock = 'rock',
    Paper = 'paper',
    Scissors = 'scissors'
}

export class CreateRPSGameDTO {
    @ApiProperty({
        example: 'rock',
        description: `The player's move (rock, paper, or scissors).`
    })
    @IsEnum(Move)
    @IsNotEmpty()
    playerMove: Move

    @ApiProperty({
        example: 10,
        description: `The stake amount for the game.`
    })
    @Min(0)
    @IsNumber()
    @IsNotEmpty()
    stake: number
}
