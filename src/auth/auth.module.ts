import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthService } from './auth.service'
import { MiscService } from 'libs/misc.service'
import { PassportModule } from '@nestjs/passport'
import { AuthController } from './auth.controller'
import { QueueModule } from 'src/queue/queue.module'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { HttpModule } from '@nestjs/axios'
import { ApiService } from 'libs/api.service'

@Module({
  imports: [
    JwtModule,
    HttpModule,
    QueueModule,
    PassportModule.register({ defaultStrategy: 'jwt' })
  ],
  controllers: [AuthController],
  providers: [
    ApiService,
    AuthService,
    MiscService,
    PrismaService,
    ResponseService,
  ],
  exports: [AuthService]
})
export class AuthModule { }
