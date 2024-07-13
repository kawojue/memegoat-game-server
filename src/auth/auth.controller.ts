import { Response } from 'express'
import { AuthService } from './auth.service'
import {
  Body, Controller, Patch, Post, Req, Res, UseGuards
} from '@nestjs/common'
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { ConnectWalletDTO, UsernameDTO } from './dto/auth.dto'

@ApiTags("Auth")
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('/connect-wallet')
  async connectWallet(@Res() res: Response, @Body() body: ConnectWalletDTO) {
    return await this.authService.connectWallet(res, body)
  }

  @Patch('/username')
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  async editUsername(
    @Req() req: IRequest,
    @Res() res: Response,
    @Body() body: UsernameDTO,
  ) {
    await this.authService.editUsername(res, req.user, body)
  }
}
