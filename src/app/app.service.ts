import { UAParser } from 'ua-parser-js';
import { Injectable } from '@nestjs/common';
import { TournamentService, txData } from 'libs/tournament.service';

@Injectable()
export class AppService {
  constructor(private txService: TournamentService) {}
  base(userAgent: string, ip: string) {
    const parser = new UAParser(userAgent).getResult();

    const os = parser.os.name;
    const device = parser.device.model;
    const cpu = parser.cpu.architecture;
    const browser = parser.browser.name;
    const deviceType = parser.device.type;

    return { ip, os, device, browser, deviceType, cpu };
  }

  async testTransaction(tx: txData) {
    await this.txService.storeTournamentRewards(tx, 1);
  }
}
