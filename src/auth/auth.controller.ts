import { Response } from 'express'
import { AuthService } from './auth.service'
import { StatusCodes } from 'enums/StatusCodes'
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard'
import { ResponseService } from 'libs/response.service'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import {
  Body, Controller, Get, Patch, Post, Req, Res, UseGuards
} from '@nestjs/common'
import { ConnectWalletDTO, UsernameDTO } from './dto/auth.dto'

@ApiTags("Auth")
@Controller('auth')
export class AuthController {
  private isProd: boolean

  constructor(
    private readonly authService: AuthService,
    private readonly response: ResponseService,
  ) {
    this.isProd = process.env.NODE_ENV === "production"
  }

  @Post('/connect-wallet')
  async connectWallet(@Res() res: Response, @Body() body: ConnectWalletDTO) {
    try {
      const data = await this.authService.connectWallet(body)

      res.cookie('access_token', data.access_token, {
        sameSite: this.isProd ? 'none' : 'lax',
        secure: this.isProd,
        maxAge: 120 * 24 * 60 * 60 * 1000,
      })

      return this.response.sendSuccess(res, StatusCodes.OK, { data })

      // res.redirect(process.env.REDIRECT_URL || 'http://localhost:3000/games')
    } catch (err) {
      res.redirect('http://localhost:3000/failed')
    }
  }

  @ApiCookieAuth()
  @Patch('/username')
  @UseGuards(JwtAuthGuard)
  async editUsername(
    @Req() req: IRequest,
    @Res() res: Response,
    @Body() body: UsernameDTO,
  ) {
    await this.authService.editUsername(res, req.user, body)
  }

  @Get('/profile')
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  async profile(@Res() res: Response, @Req() req: IRequest) {
    await this.authService.profile(res, req.user)
  }
}
