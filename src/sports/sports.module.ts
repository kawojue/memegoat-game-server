import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { ApiService } from 'libs/api.service';
import { SportsService } from './sports.service';
import { PassportModule } from '@nestjs/passport';
import { QueueModule } from 'src/queue/queue.module';
import { PrismaService } from 'prisma/prisma.service';
import { SportsController } from './sports.controller';
import { ResponseService } from 'libs/response.service';
import { MiscService } from 'libs/misc.service';

@Module({
  imports: [
    JwtModule,
    HttpModule,
    QueueModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [SportsController],
  providers: [
    ApiService,
    SportsService,
    PrismaService,
    ResponseService,
    MiscService,
  ],
  exports: [SportsService],
})
export class SportsModule {}
