import { Response } from 'express'
import { Injectable } from '@nestjs/common'
import { MiscService } from 'libs/misc.service'
import { StatusCodes } from 'enums/StatusCodes'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'

@Injectable()
export class GamesService {
    constructor(
        private readonly misc: MiscService,
        private readonly prisma: PrismaService,
        private readonly response: ResponseService,
    ) { }

    async buyTicket(res: Response, { sub }: ExpressUser) {
        /* Some Web3 CONTRACT TRANSACTIONS STUFF HERE */

        /* Assuming 100 tickets equal $0.05 */

        const qty = 100

        await this.prisma.stat.update({
            where: { userId: sub },
            data: { tickets: { increment: qty } }
        })

        this.response.sendSuccess(res, StatusCodes.OK, {})
    }
}
