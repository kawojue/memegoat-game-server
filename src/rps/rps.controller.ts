import { Response } from 'express'
import { RPSService } from './rps.service'
import {
  Body, Controller, Post, Req, Res, UseGuards
} from '@nestjs/common'
import { CreateRPSGameDTO } from './dto/rps.dto'
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'

@ApiTags("Rock-Paper-Scissors")
@Controller('rps')
export class RpsController {
  constructor(private readonly rpsService: RPSService) { }

  @Post('/create')
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  async createGame(
    @Req() req: IRequest,
    @Res() res: Response,
    @Body() body: CreateRPSGameDTO
  ) {
    await this.rpsService.createGame(res, req.user, body)
  }
}
