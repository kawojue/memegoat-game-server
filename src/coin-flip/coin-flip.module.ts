import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { MiscService } from 'libs/misc.service'
import { PassportModule } from '@nestjs/passport'
import { CoinFlipService } from './coin-flip.service'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { CoinFlipController } from './coin-flip.controller'

@Module({
  imports: [JwtModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [CoinFlipController],
  providers: [
    MiscService,
    PrismaService,
    CoinFlipService,
    ResponseService,
  ],
})
export class CoinFlipModule { }
