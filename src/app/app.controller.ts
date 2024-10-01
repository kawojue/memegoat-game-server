import { RealIP } from 'nestjs-real-ip';
import { AppService } from './app.service';
import { Get, Controller, Headers } from '@nestjs/common';
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  base(@Headers('user-agent') userAgent: string, @RealIP() ip: string) {
    return this.appService.base(userAgent, ip);
  }
}
