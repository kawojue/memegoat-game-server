import { Response } from 'express'
import { StatusCodes } from 'enums/StatusCodes'
import { RouletteService } from './roulette.service'
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard'
import { ResponseService } from 'libs/response.service'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { Bet, CreateRouletteGameDTO } from './dto/roulette.dto'
import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common'

@ApiTags("Roulette")
@Controller('roulette')
export class RouletteController {
  constructor(
    private readonly response: ResponseService,
    private readonly rouletteService: RouletteService,
  ) { }

  @Post('/odds')
  getOdds(@Res() res: Response, @Body() { bets }: { bets: Bet[] }) {
    const odds = this.rouletteService.calculateOdds(bets)
    this.response.sendSuccess(res, StatusCodes.OK, { data: { odds } })
  }

  @Post('/create')
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  async createGame(
    @Req() req: IRequest,
    @Res() res: Response,
    @Body() body: CreateRouletteGameDTO
  ) {
    await this.rouletteService.createGame(res, req.user, body)
  }
}
