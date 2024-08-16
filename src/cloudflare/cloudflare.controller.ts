import {
  Get,
  Res,
  Post,
  Param,
  UseGuards,
  Controller,
} from '@nestjs/common'
import { Response } from 'express'
import { StatusCodes } from 'enums/StatusCodes'
import { ResponseService } from 'libs/response.service'
import { SignatureAuthGuard } from './cloudflare.guard'
import { CloudflareService } from './cloudflare.service'

UseGuards(SignatureAuthGuard)
@Controller('cloudflare')
export class CloudflareController {
  constructor(
    private readonly response: ResponseService,
    private readonly cloudflareService: CloudflareService
  ) { }

  @Post('/create')
  async createDeployment(@Res() res: Response) {
    const data = await this.cloudflareService.getDeployments()
    return this.response.sendSuccess(res, StatusCodes.Created, { data })
  }

  @Get('/deployments')
  async getDeployments(@Res() res: Response) {
    const data = await this.cloudflareService.getDeployments()
    return this.response.sendSuccess(res, StatusCodes.OK, { data })
  }

  @Get('/deployments/:deploymentId')
  async getDeploymentInfo(@Res() res: Response, @Param('deploymentId') deploymentId: string) {
    const data = await this.cloudflareService.getDeploymentInfo(deploymentId)
    return this.response.sendSuccess(res, StatusCodes.OK, { data })
  }

  @Post('/deployments/:deploymentId/retry')
  async retryDeployment(@Res() res: Response, @Param('deploymentId') deploymentId: string) {
    const data = await this.cloudflareService.retryDeployment(deploymentId)
    return this.response.sendSuccess(res, StatusCodes.OK, { data })
  }
}
