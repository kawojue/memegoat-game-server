import { Response } from 'express'
import { StatusCodes } from 'enums/StatusCodes'
import { CoinFlipService } from './coin-flip.service'
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard'
import { CreateCoinGameDTO, TH } from './dto/coin.dto'
import { ResponseService } from 'libs/response.service'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common'

@ApiTags("Coin Flip")
@Controller('coin-flip')
export class CoinFlipController {
  constructor(
    private readonly response: ResponseService,
    private readonly coinFlipService: CoinFlipService
  ) { }

  @Post('/create')
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  async createGame(
    @Res() res: Response,
    @Req() req: IRequest,
    @Body() body: CreateCoinGameDTO,
  ) {
    await this.coinFlipService.createGame(res, req.user, body)
  }

  @Post('/odds')
  getOdds(@Res() res: Response, @Body() guesses: TH) {
    const odds = this.coinFlipService.calculateOdds(guesses)
    this.response.sendSuccess(res, StatusCodes.OK, { data: { odds } })
  }
}
