import { Module } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { DiceModule } from './dice/dice.module'
import { MiscService } from 'libs/misc.service'
import { AppController } from './app.controller'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { CoinFlipModule } from './coin-flip/coin-flip.module'
import { JwtModule } from './jwt/jwt.module'

@Module({
  imports: [
    AuthModule,
    DiceModule,
    JwtModule,
    CoinFlipModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtService,
    MiscService,
    PrismaService,
    ResponseService,
  ],
})
export class AppModule { }
