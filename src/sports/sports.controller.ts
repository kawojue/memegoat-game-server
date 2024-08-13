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

  @Get('/fixures')
  async inPlayLivescore(@Res() res: Response) {
    const fixures = await this.sportsService.inPlayLivescore()
    this.response.sendSuccess(res, StatusCodes.OK, { data: fixures })
  }
}
