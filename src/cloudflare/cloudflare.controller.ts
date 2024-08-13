import { Controller, Get, Res } from '@nestjs/common'
import { ResponseService } from 'libs/response.service'
import { CloudflareService } from './cloudflare.service'
import { Response } from 'express'
import { StatusCodes } from 'enums/StatusCodes'

@Controller('cloudflare')
export class CloudflareController {
  constructor(
    private readonly response: ResponseService,
    private readonly cloudflareService: CloudflareService
  ) { }

  @Get('')
  async getDeployments(@Res() res: Response) {
    const data = await this.cloudflareService.getDeployments()
    return this.response.sendSuccess(res, StatusCodes.OK, { data })
  }
}
