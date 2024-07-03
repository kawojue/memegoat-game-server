import { Controller } from '@nestjs/common'
import { DiceService } from './dice.service'
import { ApiTags } from '@nestjs/swagger'

@ApiTags("Dice")
@Controller('dice')
export class DiceController {
  constructor(private readonly diceService: DiceService) { }
}
