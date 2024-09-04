import { Module } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { MiscService } from 'libs/misc.service'
import { RandomService } from 'libs/random.service'
import { RealtimeGateway } from './realtime.gateway'
import { RealtimeService } from './realtime.service'
import { StoreModule } from 'src/store/store.module'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { BlackjackService } from 'libs/blackJack.service'

@Module({
  imports: [StoreModule],
  providers: [
    RealtimeGateway,
    RealtimeService,
    {
      provide: RandomService,
      useFactory: () => new RandomService('sha256')
    },
    JwtService,
    MiscService,
    PrismaService,
    ResponseService,
    BlackjackService,
  ],
})
export class RealtimeModule { }
