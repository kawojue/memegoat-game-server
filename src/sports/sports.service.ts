import {
    Injectable,
    ConflictException,
    BadRequestException,
    NotFoundException,
    UnprocessableEntityException,
} from '@nestjs/common'
import { PlacebetDTO } from './sports.dto'
import { ApiService } from 'libs/api.service'
import { PrismaService } from 'prisma/prisma.service'

@Injectable()
export class SportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly apiService: ApiService,
    ) { }

    async placebet(
        { sub: userId }: ExpressUser,
        { stake, placebetOutcome, fixtureId }: PlacebetDTO
    ) {
        const placedBetAlready = await this.prisma.sportBet.findUnique({
            where: {
                fixureId_userId: {
                    userId,
                    fixureId: fixtureId.toString(),
                }
            }
        })

        if (placedBetAlready) {
            throw new ConflictException("Same bet placed already")
        }

        let potentialWin = 0
        switch (placebetOutcome) {
            case 'away':
            case 'home':
                potentialWin = stake * 2
                break

            case 'draw':
                potentialWin = stake * 3
                break
            default:
                throw new BadRequestException("Invalid bet outcome")
        }

        const stat = await this.prisma.stat.findFirst({
            where: { userId },
        })

        if (stat.tickets < stake) {
            throw new UnprocessableEntityException("Insufficient tickets")
        }

        const fixture = await this.apiService.apiSportGET<any>(`/fixtures?id=${fixtureId}`)

        if (!fixture) {
            throw new NotFoundException("Fixture not found")
        }

        const game = fixture.response as FootballMatchResponse
        if (game.fixture.status.elapsed > 20) {
            throw new UnprocessableEntityException("Game has already started")
        }

        const [bet] = await this.prisma.$transaction([
            this.prisma.sportBet.create({
                data: {
                    stake, status: 'ONGOING',
                    fixureId: fixtureId.toString(),
                    outcome: 'NOT_DECIDED',
                    goals: {
                        away: game.goals.away,
                        home: game.goals.away,
                    },
                    potentialWin, placebetOutcome,
                    user: { connect: { id: userId } }
                }
            }),
            this.prisma.stat.update({
                where: { userId },
                data: {
                    tickets: { decrement: stake }
                }
            }),
        ])

        return bet
    }

    async fetchUsersBets(
        { sub: userId }: ExpressUser,

    ) {

    }
}
