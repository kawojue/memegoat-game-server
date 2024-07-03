import { ApiTags } from '@nestjs/swagger'
import { Request, Response } from 'express'
import { AuthService } from './auth.service'
import {
  Body, Controller, HttpCode, Post, Req, Res
} from '@nestjs/common'
import { ConnectWalletDTO } from './dto/auth.dto'

@ApiTags("Auth")
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @HttpCode(200)
  @Post('/refresh-token')
  async refreshAccessToken(@Req() req: Request, @Res() res: Response) {
    return await this.authService.refreshAccessToken(req, res)
  }

  @HttpCode(201)
  @Post('/connect-wallet')
  async connectWallet(@Res() res: Response, @Body() body: ConnectWalletDTO) {
    return await this.authService.connectWallet(res, body)
  }
}
