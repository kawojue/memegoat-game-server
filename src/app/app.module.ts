import { AppService } from './app.service'
import { HttpModule } from '@nestjs/axios'
import { ApiService } from 'libs/api.service'
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
import { CloudflareModule } from 'src/cloudflare/cloudflare.module'
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { CustomAuthMiddlware } from 'src/middlewares/custom-auth.guard.middleware'

@Module({
  imports: [
    AuthModule,
    JwtModule,
    HttpModule,
    GamesModule,
    SportsModule,
    WebhookModule,
    RealtimeModule,
    CloudflareModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtService,
    ApiService,
    MiscService,
    TaskService,
    PrismaService,
    ResponseService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CustomAuthMiddlware)
      .forRoutes('*')
  }
}
