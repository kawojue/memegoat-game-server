import { Module } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { RandomService } from 'libs/random.service'
import { RealtimeGateway } from './realtime.gateway'
import { RealtimeService } from './realtime.service'
import { PrismaService } from 'prisma/prisma.service'

@Module({
  providers: [
    RealtimeGateway,
    RealtimeService,
    {
      provide: RandomService,
      useFactory: () => new RandomService('sha256')
    },
    PrismaService,
    JwtService,
  ],
})
export class RealtimeModule { }
