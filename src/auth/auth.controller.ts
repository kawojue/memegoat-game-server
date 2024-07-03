import { ApiTags } from '@nestjs/swagger'
import { Request, Response } from 'express'
import { AuthService } from './auth.service'
import {
  Body, Controller, Patch, Post, Req, Res, UseGuards
} from '@nestjs/common'
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard'
import { ConnectWalletDTO, UsernameDTO } from './dto/auth.dto'

@ApiTags("Auth")
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('/refresh-token')
  async refreshAccessToken(@Req() req: Request, @Res() res: Response) {
    return await this.authService.refreshAccessToken(req, res)
  }

  @Post('/connect-wallet')
  async connectWallet(@Res() res: Response, @Body() body: ConnectWalletDTO) {
    return await this.authService.connectWallet(res, body)
  }

  @Patch('/username')
  @UseGuards(JwtAuthGuard)
  async editUsername(
    @Req() req: IRequest,
    @Res() res: Response,
    @Body() body: UsernameDTO,
  ) {
    await this.authService.editUsername(res, req.user, body)
  }
}
