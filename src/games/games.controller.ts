import {
  Body,
  Controller,
  Post, Req, Res,
} from '@nestjs/common'
import { Response } from 'express'
import { ApiTags } from '@nestjs/swagger'
import { CanStakeDTO } from './dto/index.dto'
import { GamesService } from './games.service'

@ApiTags("Games")
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) { }

  // TODO: BUY TIcket


  @Post('/can-stake')
  async canStake(
    @Req() req: IRequest,
    @Res() res: Response,
    @Body() { stake }: CanStakeDTO
  ) {
    await this.gamesService.canStake(res, req.user, { stake })
  }
}
