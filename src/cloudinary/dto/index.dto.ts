import { Transform } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class FolderDTO {
  @ApiProperty({
    example: 'flags',
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value.trim().replace(/ /g, '-').toUpperCase())
  folderName: string
}
