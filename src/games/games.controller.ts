import {
  Body,
  Controller,
  Post, Req, Res,
} from '@nestjs/common'
import { Response } from 'express'
import { ApiTags } from '@nestjs/swagger'
import { GamesService } from './games.service'

@ApiTags("Games")
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) { }

  // TODO: BUY TIcket

}
