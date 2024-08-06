import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { ApiService } from 'libs/api.service'
import { SportsService } from './sports.service'
import { SportsController } from './sports.controller'
import { ResponseService } from 'libs/response.service'
import { PrismaService } from 'prisma/prisma.service'

@Module({
  imports: [HttpModule],
  controllers: [SportsController],
  providers: [
    SportsService,
    ApiService,
    PrismaService,
    ResponseService,
  ],
})
export class SportsModule { }
