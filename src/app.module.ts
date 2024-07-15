import { Module } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { AppService } from './app.service'
import { JwtModule } from './jwt/jwt.module'
import { TaskService } from 'libs/task.service'
import { AuthModule } from './auth/auth.module'
import { MiscService } from 'libs/misc.service'
import { AppController } from './app.controller'
import { ScheduleModule } from '@nestjs/schedule'
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
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtService,
    MiscService,
    TaskService,
    PrismaService,
    ResponseService,
  ],
})
export class AppModule { }
