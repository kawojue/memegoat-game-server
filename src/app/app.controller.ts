import { Request } from 'express';
import { AppService } from './app.service';
import { Req, Get, Post, Controller } from '@nestjs/common';
import { contractDTO, ContractService } from 'libs/contract.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly contractService: ContractService,
  ) { }

  @Get()
  base(@Req() req: Request) {
    return this.appService.base(req);
  }

  // @Post('/rng')
  // async rng() {
  //   const data: contractDTO = {
  //     contract: 'memegoat-lottery-rng',
  //     function: 'get-final-number',
  //     arguments: [],
  //   };
  //   const rng = await this.contractService.readContract(data);
  //   return rng;
  // }
}
