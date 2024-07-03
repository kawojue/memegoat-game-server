import { Response } from 'express'
import { ApiTags } from '@nestjs/swagger'
import { StatusCodes } from 'enums/StatusCodes'
import { CoinFlipService } from './coin-flip.service'
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard'
import { ResponseService } from 'libs/response.service'
import { CoinFlipRoundDTO, CreateCoinGameDTO } from './dto/coin.dto'
import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common'

@ApiTags("Coin Flip")
@Controller('coin-flip')
export class CoinFlipController {
  constructor(
    private readonly response: ResponseService,
    private readonly coinFlipService: CoinFlipService
  ) { }

  @Post('/create')
  @UseGuards(JwtAuthGuard)
  async createGame(
    @Res() res: Response,
    @Req() req: IRequest,
    @Body() body: CreateCoinGameDTO,
  ) {
    await this.coinFlipService.createGame(res, req.user, body)
  }

  @Post('/odds')
  async getOdds(@Res() res: Response, @Body() { rounds }: CoinFlipRoundDTO) {
    const odds = this.coinFlipService.calculateOdds(rounds.map(round => round.guess))
    this.response.sendSuccess(res, StatusCodes.OK, { data: { odds } })
  }
}
