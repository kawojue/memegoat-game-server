import { RealIP } from 'nestjs-real-ip';
import { AppService } from './app.service';
import { Get, Controller, Headers } from '@nestjs/common';
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
}
