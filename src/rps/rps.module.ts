import { Module } from '@nestjs/common'
import { RPSService } from './rps.service'
import { JwtModule } from 'src/jwt/jwt.module'
import { MiscService } from 'libs/misc.service'
import { RpsController } from './rps.controller'
import { PassportModule } from '@nestjs/passport'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'

@Module({
  imports: [JwtModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [RpsController],
  providers: [
    RPSService,
    MiscService,
    PrismaService,
    ResponseService,
  ],
})
export class RpsModule { }
