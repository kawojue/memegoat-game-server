import {
  Req,
  Res,
  Get,
  Query,
  Controller,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Request, Response } from 'express'
import { GamesService } from './games.service'
import { StatusCodes } from 'enums/StatusCodes'
import { PaginationDTO } from './dto/pagination'
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
  async overrallLeaderboard(@Query() q: PaginationDTO, @Res() res: Response) {
    const data = await this.gamesService.overallLeaderboard(q)
    return this.response.sendSuccess(res, StatusCodes.OK, { ...data })
  }

  @Get('/overall-leaderboard/position')
  async overallPosition(@Req() req: Request, @Res() res: Response) {
    // @ts-ignore
    const position = await this.gamesService.overallPosition(req.user?.sub)
    return this.response.sendSuccess(res, StatusCodes.OK, { data: position })
  }

  @Get('/tournament-leaderboard')
  async tournamentLeaderboard(@Query() q: PaginationDTO, @Res() res: Response) {
    const data = await this.gamesService.getCurrentTournamentLeaderboard(q)
    return this.response.sendSuccess(res, StatusCodes.OK, { ...data })
  }

  @Get('/tournament-leaderboard/position')
  async tournamentPosition(@Req() req: Request, @Res() res: Response) {
    // @ts-ignore
    const position = await this.gamesService.tournamentPosition(req.user?.sub)
    return this.response.sendSuccess(res, StatusCodes.OK, { data: position })
  }
}
