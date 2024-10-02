import { RealIP } from 'nestjs-real-ip';
import { AppService } from './app.service';
import { Response } from 'express';

import { Get, Controller, Headers, Query, Post, Res } from '@nestjs/common';
import { StatusCodes } from 'enums/StatusCodes';
import { ResponseService } from 'libs/response.service';
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

  @Post('tickets')
  getTickets(@Res() res: Response, @Query() body: { address: string }) {
    const tickets = this.appService.getSTXdeposit(body.address);
    return this.response.sendSuccess(res, StatusCodes.OK, {
      data: tickets,
    });
  }
}
