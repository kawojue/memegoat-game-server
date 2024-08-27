import { ApiProperty } from "@nestjs/swagger"
import { PlacebetOutcome } from "@prisma/client"
import { PaginationDTO } from "src/games/dto/pagination"
import { IsEnum, IsNotEmpty, IsNumber, IsOptional } from "class-validator"
import { Transform } from "class-transformer"

enum Timezone {
    UTC = "UTC",
    "EPL" = "EPL"
}

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

export class FetchFixturesDTO extends PaginationDTO {
    @ApiProperty({
        enum: Timezone,
        required: false,
    })
    @IsOptional()
    @IsEnum(Timezone)
    @Transform(({ value }) => {
        if (value === "EPL") {
            return "Europe/London"
        }
    })
    timezone: Timezone
}