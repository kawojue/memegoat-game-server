import { Request } from 'express'
import { AppService } from './app.service'
import { Controller, Get, Req } from '@nestjs/common'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  base(@Req() req: Request) {
    return this.appService.base(req)
  }
}
