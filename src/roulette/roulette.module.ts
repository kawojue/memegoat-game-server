import { Module } from '@nestjs/common'
import { JwtModule } from 'src/jwt/jwt.module'
import { MiscService } from 'libs/misc.service'
import { PassportModule } from '@nestjs/passport'
import { RouletteService } from './roulette.service'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { RouletteController } from './roulette.controller'

@Module({
  imports: [JwtModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [RouletteController],
  providers: [
    RouletteService,
    MiscService,
    PrismaService,
    ResponseService,
  ],
})
export class RouletteModule { }
