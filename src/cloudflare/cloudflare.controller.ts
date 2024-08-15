import { Response } from 'express'
import { StatusCodes } from 'enums/StatusCodes'
import { ResponseService } from 'libs/response.service'
import { CloudflareService } from './cloudflare.service'
import { Controller, Get, Post, Res } from '@nestjs/common'

@Controller('cloudflare')
export class CloudflareController {
  constructor(
    private readonly response: ResponseService,
    private readonly cloudflareService: CloudflareService
  ) { }

  @Get('/deployments')
  async getDeployments(@Res() res: Response) {
    const data = await this.cloudflareService.getDeployments()
    return this.response.sendSuccess(res, StatusCodes.OK, { data })
  }

  @Post('/create')
  async createDeployment(@Res() res: Response) {
    const data = await this.cloudflareService.getDeployments()
    return this.response.sendSuccess(res, StatusCodes.OK, { data })
  }
}
