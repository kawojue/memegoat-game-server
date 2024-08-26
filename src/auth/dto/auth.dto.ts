import { USER_REGEX } from 'utils/regExp';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class ConnectWalletDTO {
  @ApiProperty({
    example: 'x0cd..',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address: string;

  @ApiProperty({
    example: 'b3x0cd..',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  publicKey: string;

  @ApiProperty({
    example: 'b3x0cd..',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({
    example: 'signature req..',
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class UsernameDTO {
  @ApiProperty({
    example: 'kawojue_',
  })
  @Matches(USER_REGEX, {
    message: 'Invalid username',
  })
  @IsString()
  @IsNotEmpty()
  username: string;
}
