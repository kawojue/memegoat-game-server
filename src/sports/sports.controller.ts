import { Response } from 'express'
import { StatusCodes } from 'enums/StatusCodes'
import { SportsService } from './sports.service'
import { Controller, Get, Res } from '@nestjs/common'
import { ResponseService } from 'libs/response.service'

@Controller('sports')
export class SportsController {
  constructor(
    private readonly response: ResponseService,
    private readonly sportsService: SportsService,
  ) { }

  @Get('/in-play')
  async inPlayLivescore(@Res() res: Response) {
    const livescores = await this.sportsService.inPlayLivescore()
    this.response.sendSuccess(res, StatusCodes.OK, { data: livescores })
  }
}
