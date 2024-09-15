import {
  Get,
  Req,
  Res,
  Body,
  Post,
  Patch,
  UseGuards,
  Controller,
} from '@nestjs/common';
import { Response } from 'express';
import { env } from 'configs/env.config';
import { AuthService } from './auth.service';
import { StatusCodes } from 'enums/StatusCodes';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';
import { ResponseService } from 'libs/response.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConnectWalletDTO, UsernameDTO } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly response: ResponseService,
  ) { }

  @Post('/connect-wallet')
  async connectWallet(
    @Res({ passthrough: true }) res: Response,
    @Body() body: ConnectWalletDTO,
  ) {
    const data = await this.authService.connectWallet(body);

    // res.cookie('access_token', data.access_token, {
    //   sameSite: env.isProd ? 'none' : 'lax',
    //   secure: env.isProd,
    //   maxAge: 120 * 24 * 60 * 60 * 1000,
    // });

    return this.response.sendSuccess(res, StatusCodes.OK, { data });
  }

  @ApiBearerAuth()
  @Patch('/username')
  @UseGuards(JwtAuthGuard)
  async editUsername(
    @Req() req: IRequest,
    @Res() res: Response,
    @Body() body: UsernameDTO,
  ) {
    await this.authService.editUsername(res, req.user, body);
  }

  @Get('/profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async profile(@Res() res: Response, @Req() req: IRequest) {
    await this.authService.profile(res, req.user);
  }

  @Get('/reward')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async reward(@Res() res: Response, @Req() req: IRequest) {
    await this.authService.reward(res, req.user)
  }

  @ApiBearerAuth()
  @Post('/claim-reward')
  @UseGuards(JwtAuthGuard)
  async claimReward(@Res() res: Response, @Req() req: IRequest) {
    await this.authService.claimReward(res, req.user)
  }
}
