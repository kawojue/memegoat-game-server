import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { HttpModule } from '@nestjs/axios'
import { AuthService } from './auth.service'
import { ApiService } from 'libs/api.service'
import { MiscService } from 'libs/misc.service'
import { PassportModule } from '@nestjs/passport'
import { AuthController } from './auth.controller'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'

@Module({
  imports: [
    JwtModule,
    HttpModule,
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
