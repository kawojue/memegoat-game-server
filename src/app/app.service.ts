import { UAParser } from 'ua-parser-js';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { contractDTO, ContractService } from 'libs/contract.service';
import { MiscService } from 'libs/misc.service';

@Injectable()
export class AppService {
  constructor(
    private misc: MiscService,
    private prisma: PrismaService,
    private contract: ContractService,
  ) {}

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

  async analysis() {
    const {
      _sum: { boughtTickets: totalTicketsBought },
    } = await this.prisma.ticketRecords.aggregate({
      _sum: {
        boughtTickets: true,
      },
    });

    const uniqueAddresses = await this.prisma.user.count();
    const stxVolume = this.misc.getStxAmount(totalTicketsBought);
    const goatBurnt =
      (await this.prisma.transaction.count({
        where: {
          tag: 'BURN-GOAT',
          txStatus: 'Success',
        },
      })) * 500;

    return {
      totalTicketsBought,
      uniqueAddresses,
      stxVolume,
      goatBurnt,
    };
  }
}
