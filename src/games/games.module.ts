import { Module } from '@nestjs/common'
import { JwtModule } from 'src/jwt/jwt.module'
import { GamesService } from './games.service'
import { PassportModule } from '@nestjs/passport'
import { GamesController } from './games.controller'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'

@Module({
  imports: [
    JwtModule,
    PassportModule.register({ defaultStrategy: 'jwt' })
  ],
  controllers: [GamesController],
  providers: [
    GamesService,
    PrismaService,
    ResponseService,
  ],
  exports: [GamesService]
})
export class GamesModule { }
