import { Module } from '@nestjs/common'
import { DiceService } from './dice.service'
import { JwtModule } from 'src/jwt/jwt.module'
import { MiscService } from 'libs/misc.service'
import { PassportModule } from '@nestjs/passport'
import { DiceController } from './dice.controller'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'

@Module({
  imports: [JwtModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [DiceController],
  providers: [
    DiceService,
    MiscService,
    PrismaService,
    ResponseService,
  ],
})
export class DiceModule { }
