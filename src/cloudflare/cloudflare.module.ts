import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { ApiService } from 'libs/api.service'
import { ResponseService } from 'libs/response.service'
import { CloudflareService } from './cloudflare.service'
import { CloudflareController } from './cloudflare.controller'

@Module({
  imports: [
    HttpModule,
  ],
  controllers: [CloudflareController],
  providers: [
    CloudflareService,
    ApiService,
    ResponseService,
  ],
})
export class CloudflareModule { }
