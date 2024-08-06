import { Module } from '@nestjs/common'
import { AppService } from './app.service'
import { TaskService } from 'libs/task.service'
import { MiscService } from 'libs/misc.service'
import { AppController } from './app.controller'
import { ScheduleModule } from '@nestjs/schedule'
import { AuthModule } from 'src/auth/auth.module'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { GamesModule } from 'src/games/games.module'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { SportsModule } from 'src/sports/sports.module'
import { WebhookModule } from 'src/webhook/webhook.module'
import { RealtimeModule } from 'src/realtime/realtime.module'

@Module({
  imports: [
    AuthModule,
    JwtModule,
    GamesModule,
    SportsModule,
    WebhookModule,
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
