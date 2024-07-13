import {
    IsString,
    IsNumber,
    IsBoolean,
    IsNotEmpty,
    IsOptional,
} from 'class-validator'

export class PointsDTO {
    @IsNotEmpty()
    @IsString()
    addr: string

    @IsBoolean()
    @IsOptional()
    isStakePoints: boolean

    @IsNumber()
    @IsOptional()
    amountStaked: number

    @IsNumber()
    @IsOptional()
    stakingPoints?: number

    @IsNumber()
    @IsOptional()
    referralPoints?: number
}