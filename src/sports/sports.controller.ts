import { Response } from 'express'
import { ApiTags } from '@nestjs/swagger'
import { ApiService } from 'libs/api.service'
import { StatusCodes } from 'enums/StatusCodes'
import { SportsService } from './sports.service'
import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common'
import { ResponseService } from 'libs/response.service'
import { PlacebetDTO } from './sports.dto'

@ApiTags('Sports')
@Controller('sports')
export class SportsController {
  constructor(
    private readonly apiService: ApiService,
    private readonly response: ResponseService,
    private readonly sportsService: SportsService,
  ) { }

  @Get('/timezones')
  async getTimezones(@Res() res: Response) {
    const timezones = await this.apiService.apiSportGET(`timezone`)
    return this.response.sendSuccess(res, StatusCodes.OK, { data: timezones })
  }

  @Get('/countries')
  async getCountries(@Res() res: Response) {
    const countries = await this.apiService.apiSportGET(`countries`)
    return this.response.sendSuccess(res, StatusCodes.OK, { data: countries })
  }

  @Get('/leagues')
  async getCurrentLeagues(@Res() res: Response) {
    const leagues = await this.apiService.apiSportGET(`leagues?current=true`)
    return this.response.sendSuccess(res, StatusCodes.OK, { data: leagues })
  }

  @Get('/seasons')
  async getSeasons(@Res() res: Response) {
    const seasons = await this.apiService.apiSportGET(`leagues/seasons`)
    return this.response.sendSuccess(res, StatusCodes.OK, { data: seasons })
  }

  @Get('/fixtures')
  async getFixtures(@Res() res: Response) {
    const fixtures = await this.apiService.apiSportGET(`/fixtures?id=1252428`)
    // const fixtures = await this.apiService.apiSportGET(`/fixtures?live=all&timezone=Europe/London&status=1H`)
    return this.response.sendSuccess(res, StatusCodes.OK, { data: fixtures })
  }

  @Post('/place-bet')
  async placeBet(
    @Req() req: IRequest,
    @Res() res: Response,
    @Body() body: PlacebetDTO
  ) {

  }
}
