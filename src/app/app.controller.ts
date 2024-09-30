import { RealIP } from 'nestjs-real-ip';
import { AppService } from './app.service';
import { Get, Controller, Headers, Body, Post, Res } from '@nestjs/common';
import { TxDataDTO } from 'libs/tournament.service';
import { StatusCodes } from 'enums/StatusCodes';
import { ResponseService } from 'libs/response.service';
import { Response } from 'express';
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly response: ResponseService,
  ) {}

  @Get()
  base(@Headers('user-agent') userAgent: string, @RealIP() ip: string) {
    return this.appService.base(userAgent, ip);
  }

  @Post('test')
  async testTransaction(@Res() res: Response, @Body() body: TxDataDTO) {
    const data = await this.appService.testTransaction(body);
    return this.response.sendSuccess(res, StatusCodes.OK, {
      data: data,
    });
  }
}
