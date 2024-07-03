import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthService } from './auth.service'
import { MiscService } from 'libs/misc.service'
import { PassportModule } from '@nestjs/passport'
import { AuthController } from './auth.controller'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'

@Module({
  imports: [JwtModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [
    AuthService,
    MiscService,
    PrismaService,
    ResponseService,
  ],
})
export class AuthModule { }
