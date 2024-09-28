import { RealIP } from 'nestjs-real-ip';
import { AppService } from './app.service';
import { Get, Controller, Headers, Res } from '@nestjs/common';
import { ApiService } from 'libs/api.service';
import { env } from 'configs/env.config';
import { ResponseService } from 'libs/response.service';
import { StatusCodes } from 'enums/StatusCodes';
import { Response } from 'express';
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly apiService: ApiService,
    private readonly response: ResponseService,
  ) {}

  @Get()
  base(@Headers('user-agent') userAgent: string, @RealIP() ip: string) {
    return this.appService.base(userAgent, ip);
  }

  @Get('/test')
  async getBlockHeight(@Res() res: Response) {
    const data = await this.apiService.getCurrentBlock<any>(env.hiro.channel);
    const result = data.results['0'].burn_block_height;
    console.log(result, 'sdjfk');
    return this.response.sendSuccess(res, StatusCodes.OK, { res: result });
  }
}
