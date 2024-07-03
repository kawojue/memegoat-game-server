import { Module } from '@nestjs/common'
import { DiceService } from './dice.service'
import { DiceController } from './dice.controller'

@Module({
  controllers: [DiceController],
  providers: [DiceService],
})
export class DiceModule { }
