import { UAParser } from 'ua-parser-js';
import { Injectable } from '@nestjs/common';
import { contractDTO, ContractService } from 'libs/contract.service';

@Injectable()
export class AppService {
  constructor(private contract: ContractService) {}

  base(userAgent: string, ip: string) {
    const parser = new UAParser(userAgent).getResult();

    const os = parser.os.name;
    const device = parser.device.model;
    const cpu = parser.cpu.architecture;
    const browser = parser.browser.name;
    const deviceType = parser.device.type;

    return { ip, os, device, browser, deviceType, cpu };
  }

  // async getSTXdeposit(address: string) {
  //   const data: contractDTO = {
  //     contract: 'memegoat-games-master',
  //     function: 'get-user-tickets-record ',
  //     arguments: [{ arg: address, type: 'principal' }],
  //   };

  //   return await this.contract.readContract(data);
  // }
}
