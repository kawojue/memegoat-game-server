import { env } from 'configs/env.config'
import { AppService } from './app.service'
import { HttpModule } from '@nestjs/axios'
import { BullModule } from '@nestjs/bullmq'
import { ApiService } from 'libs/api.service'
import { MiscService } from 'libs/misc.service'
import { AppController } from './app.controller'
import { TaskModule } from 'src/task/task.module'
import { ScheduleModule } from '@nestjs/schedule'
import { AuthModule } from 'src/auth/auth.module'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { StoreModule } from 'src/store/store.module'
import { GamesModule } from 'src/games/games.module'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { SportsModule } from 'src/sports/sports.module'
import { WebhookModule } from 'src/webhook/webhook.module'
import { RealtimeModule } from 'src/realtime/realtime.module'
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module'
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { CustomAuthMiddleware } from 'src/middlewares/custom-auth.middleware'

@Module({
  imports: [
    AuthModule,
    JwtModule,
    HttpModule,
    TaskModule,
    GamesModule,
    StoreModule,
    SportsModule,
    WebhookModule,
    RealtimeModule,
    CloudinaryModule,
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: env.redis.host,
        port: env.redis.port,
        ...(env.redis.username && {
          password: env.redis.password,
          username: env.redis.username,
        }),
      }
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtService,
    ApiService,
    MiscService,
    PrismaService,
    ResponseService,
  ],
  exports: [AppService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CustomAuthMiddleware)
      .forRoutes('*')
  }
}
