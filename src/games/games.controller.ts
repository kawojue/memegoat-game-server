import {
  Req,
  Res,
  Get,
  Query,
  UseGuards,
  Controller,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { GamesService } from './games.service'
import { StatusCodes } from 'enums/StatusCodes'
import { PaginationDTO } from './dto/pagination'
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard'
import { ResponseService } from 'libs/response.service'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

@ApiTags("Games")
@Controller('games')
export class GamesController {
  constructor(
    private readonly response: ResponseService,
    private readonly gamesService: GamesService,
  ) { }

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
  async getCurrentGameTournamentLeaderboard(@Query() q: PaginationDTO, @Res() res: Response) {
    const data = await this.gamesService.getCurrentGameTournamentLeaderboard(q)
    return this.response.sendSuccess(res, StatusCodes.OK, { ...data })
  }

  @Get('/tournament-leaderboard/position')
  async tournamentPosition(@Req() req: Request, @Res() res: Response) {
    // @ts-ignore
    const position = await this.gamesService.tournamentPosition(req.user?.sub)
    return this.response.sendSuccess(res, StatusCodes.OK, { data: position })
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/lottery-histories')
  async fetchLotteryHistories(
    @Req() req: IRequest,
    @Res() res: Response,
    @Query() q: PaginationDTO
  ) {
    const data = await this.gamesService.fetchLotteryHistories(req.user, q)

    return this.response.sendSuccess(res, StatusCodes.OK, { data })
  }

  @Get('/space-invader-lives')
  async fetchSpaceInvaderLives(@Res() res: Response) {
    const data = this.gamesService.fetchSpaceInvaderLives()

    return this.response.sendSuccess(res, StatusCodes.OK, { data })
  }
}
