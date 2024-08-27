import { IsEnum, IsNotEmpty, IsNumber } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"
import { PlacebetOutcome } from "@prisma/client"

export class PlacebetDTO {
    @ApiProperty({
        example: 9999
    })
    @IsNumber()
    @IsNotEmpty()
    fixtureId: number

    @ApiProperty({
        enum: PlacebetOutcome
    })
    @IsNotEmpty()
    @IsEnum(PlacebetOutcome)
    placebetOutcome: PlacebetOutcome

    @ApiProperty({
        example: 1
    })
    @IsNumber()
    @IsNotEmpty()
    stake: number
}