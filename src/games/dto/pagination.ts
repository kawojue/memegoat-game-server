import { ApiProperty } from "@nestjs/swagger"
import { IsOptional } from "class-validator"

export class PaginationDTO {
    @ApiProperty({
        example: 1,
        required: false
    })
    @IsOptional()
    page?: number

    @ApiProperty({
        example: 50,
        required: false
    })
    @IsOptional()
    limit?: number
}