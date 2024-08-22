import { Response } from 'express'
import { ApiTags } from '@nestjs/swagger'
import { StatusCodes } from 'enums/StatusCodes'
import { SportsService } from './sports.service'
import { Controller, Get, Res } from '@nestjs/common'
import { ResponseService } from 'libs/response.service'

@ApiTags('Sports')
@Controller('sports')
export class SportsController {
  constructor(
    private readonly response: ResponseService,
    private readonly sportsService: SportsService,
  ) { }

  @Get('/timezeones')
  async getTimezones(@Res() res: Response) {
    const fixures = await this.sportsService.getTimezones()
    return this.response.sendSuccess(res, StatusCodes.OK, { data: fixures })
  }

  @Get('/countries')
  async getCountries(@Res() res: Response) {
    const fixures = await this.sportsService.getCountries()
    return this.response.sendSuccess(res, StatusCodes.OK, { data: fixures })
  }
}
