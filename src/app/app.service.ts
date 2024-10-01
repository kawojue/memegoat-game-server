import { UAParser } from 'ua-parser-js';
import { Body, Injectable, Post, Res } from '@nestjs/common';
import { TournamentService, txData } from 'libs/tournament.service';
import { StatusCodes } from 'enums/StatusCodes';
import { Response } from 'express';
import { ResponseService } from 'libs/response.service';

@Injectable()
export class AppService {
  constructor(
    private txService: TournamentService,
    private readonly response: ResponseService,
  ) {}
  base(userAgent: string, ip: string) {
    const parser = new UAParser(userAgent).getResult();

    const os = parser.os.name;
    const device = parser.device.model;
    const cpu = parser.cpu.architecture;
    const browser = parser.browser.name;
    const deviceType = parser.device.type;

    return { ip, os, device, browser, deviceType, cpu };
  }

  @Post('test')
  async testTransaction(@Res() res: Response, @Body() body: txData) {
    const data = await this.txService.storeTournamentRewards(body, 1);
    return this.response.sendSuccess(res, StatusCodes.OK, {
      data: data,
    });
  }
}
