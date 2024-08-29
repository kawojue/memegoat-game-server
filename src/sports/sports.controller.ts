import {
  Get,
  Req,
  Res,
  Post,
  Body,
  Query,
  UseGuards,
  Controller,
} from '@nestjs/common'
import { Response } from 'express'
import { ApiService } from 'libs/api.service'
import { StatusCodes } from 'enums/StatusCodes'
import { SportsService } from './sports.service'
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard'
import { ResponseService } from 'libs/response.service'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { PaginationDTO } from 'src/games/dto/pagination'
import { FetchFixturesDTO, PlacebetDTO } from './sports.dto'

@ApiTags('Sports')
@Controller('sports')
export class SportsController {
  constructor(
    private readonly apiService: ApiService,
    private readonly response: ResponseService,
    private readonly sportsService: SportsService,
  ) { }

  @ApiBearerAuth()
  @Get('/timezones')
  @UseGuards(JwtAuthGuard)
  async getTimezones(@Res() res: Response) {
    const timezones = await this.apiService.apiSportGET(`timezone`)
    return this.response.sendSuccess(res, StatusCodes.OK, { data: timezones })
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/countries')
  async getCountries(@Res() res: Response) {
    const countries = await this.apiService.apiSportGET(`countries`)
    return this.response.sendSuccess(res, StatusCodes.OK, { data: countries })
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/leagues')
  async getCurrentLeagues(@Res() res: Response) {
    const leagues = await this.apiService.apiSportGET(`leagues?current=true&season=${new Date().getFullYear()}`)
    return this.response.sendSuccess(res, StatusCodes.OK, { data: leagues })
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/seasons')
  async getSeasons(@Res() res: Response) {
    const seasons = await this.apiService.apiSportGET(`leagues/seasons`)
    return this.response.sendSuccess(res, StatusCodes.OK, { data: seasons })
  }

  @ApiBearerAuth()
  @Get('/fixtures')
  @UseGuards(JwtAuthGuard)
  async fetchFixtures(@Res() res: Response, @Query() q: FetchFixturesDTO) {
    const data = await this.sportsService.fetchFixtures(q)
    return this.response.sendSuccess(res, StatusCodes.OK, { data })
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('/place-bet')
  async placeBet(
    @Req() req: IRequest,
    @Res() res: Response,
    @Body() body: PlacebetDTO
  ) {
    const data = await this.sportsService.placeBet(req.user, body)
    return this.response.sendSuccess(res, StatusCodes.Created, { data })
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/bets-history')
  async fetchUserBet(
    @Req() req: IRequest,
    @Res() res: Response,
    @Query() q: PaginationDTO
  ) {
    const data = await this.sportsService.fetchUserBets(req.user, q)
    return this.response.sendSuccess(res, StatusCodes.Created, { data })
  }

  @Get('/overall-leaderboard')
  async overrallLeaderboard(@Query() q: PaginationDTO, @Res() res: Response) {
    const data = await this.sportsService.overallLeaderboard(q)
    return this.response.sendSuccess(res, StatusCodes.OK, { ...data })
  }

  @Get('/overall-leaderboard/position')
  async overallLeaderboardPosition(@Req() req: IRequest, @Res() res: Response) {
    const position = await this.sportsService.overallLeaderboardPosition(req.user?.sub)
    return this.response.sendSuccess(res, StatusCodes.OK, { data: position })
  }

  @Get('/tournament-leaderboard')
  async tournamentLeaderboard(@Query() q: PaginationDTO, @Res() res: Response) {
    const data = await this.sportsService.getCurrentTournamentLeaderboard(q)
    return this.response.sendSuccess(res, StatusCodes.OK, { ...data })
  }

  @Get('/tournament-leaderboard/position')
  async tournamentPosition(@Req() req: IRequest, @Res() res: Response) {
    const position = await this.sportsService.tournamentPosition(req.user?.sub)
    return this.response.sendSuccess(res, StatusCodes.OK, { data: position })
  }
}
