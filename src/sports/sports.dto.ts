import { ApiProperty } from "@nestjs/swagger"
import { Transform } from "class-transformer"
import { PlacebetOutcome } from "@prisma/client"
import { PaginationDTO } from "src/games/dto/pagination"
import { IsEnum, IsNotEmpty, IsNumber, IsOptional } from "class-validator"

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
        example: 'Europe/London',
        required: false,
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (value === "EPL") {
            return "Europe/London"
        }
    })
    timezone?: string

    @ApiProperty({
        example: 1039
    })
    @IsOptional()
    leagueId?: string
}