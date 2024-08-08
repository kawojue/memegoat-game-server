import { TxStatus } from '@prisma/client'
import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsOptional } from 'class-validator'

export class FetchTxDTO {
  @ApiProperty({
    enum: TxStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(TxStatus)
  status?: TxStatus

  @ApiProperty({
    example: 'x0b1cy...',
    required: false,
  })
  @IsOptional()
  address?: string

  @ApiProperty({
    example: 'Ticket',
    required: false,
  })
  @IsOptional()
  tag?: string
}
