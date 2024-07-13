import { Module } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { AppService } from './app.service'
import { JwtModule } from './jwt/jwt.module'
import { AuthModule } from './auth/auth.module'
import { MiscService } from 'libs/misc.service'
import { AppController } from './app.controller'
import { GamesModule } from './games/games.module'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { RealtimeModule } from './realtime/realtime.module'

@Module({
  imports: [
    AuthModule,
    JwtModule,
    GamesModule,
    RealtimeModule,
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
