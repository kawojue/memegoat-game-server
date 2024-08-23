import {
  Req,
  Res,
  Get,
  Controller,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Request, Response } from 'express'
import { GamesService } from './games.service'
import { StatusCodes } from 'enums/StatusCodes'
import { ResponseService } from 'libs/response.service'

@ApiTags("Games")
@Controller('games')
export class GamesController {
  constructor(
    private readonly response: ResponseService,
    private readonly gamesService: GamesService,
  ) { }

  // TODO: BUY TIcket

  @Get('/overall-leaderboard')
  async overrallLeaderboard(@Req() req: Request, @Res() res: Response) {
    // @ts-ignore
    const data = await this.gamesService.overallLeaderboard(req.user?.sub)
    return this.response.sendSuccess(res, StatusCodes.OK, { ...data })
  }

  @Get('/tournament-leaderboard')
  async tournamentLeaderboard(@Req() req: Request, @Res() res: Response) {
    // @ts-ignore
    const data = await this.gamesService.getCurrentTournamentLeaderboard(req.user?.sub)
    return this.response.sendSuccess(res, StatusCodes.OK, { ...data })
  }
}
