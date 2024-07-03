import { Response } from 'express'
import { DiceService } from './dice.service'
import { StatusCodes } from 'enums/StatusCodes'
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard'
import { ResponseService } from 'libs/response.service'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { CreateDiceGameDTO, DiceRoundDTO } from './dto/dice.dto'
import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common'

@ApiTags("Dice")
@Controller('dice')
export class DiceController {
  constructor(
    private readonly diceService: DiceService,
    private readonly response: ResponseService,
  ) { }

  @Post('/odds')
  getOdds(@Res() res: Response, @Body() body: DiceRoundDTO) {
    const odds = this.diceService.calculateOdds(body)
    this.response.sendSuccess(res, StatusCodes.OK, { data: { odds } })
  }

  @Post('/create')
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  async createGame(
    @Req() req: IRequest,
    @Res() res: Response,
    @Body() body: CreateDiceGameDTO
  ) {
    await this.diceService.createGame(res, req.user, body)
  }
}
