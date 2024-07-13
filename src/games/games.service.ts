import { Response } from 'express'
import { Injectable } from '@nestjs/common'
import { CanStakeDTO } from './dto/index.dto'
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
    }

    async canStake(
        res: Response,
        { sub }: ExpressUser,
        { stake }: CanStakeDTO
    ) {
        const { tickets } = await this.prisma.stat.findUnique({
            where: { userId: sub }
        })

        if (tickets < stake) {
            return this.response.sendError(res, StatusCodes.UnprocessableEntity, "Out of ticket. Buy more tickets")
        }

        res.sendStatus(StatusCodes.OK)
    }
}
