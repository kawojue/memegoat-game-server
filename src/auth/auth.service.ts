import { ObjectId } from 'mongodb'
import { Response } from 'express'
import { Injectable } from '@nestjs/common'
import { MiscService } from 'libs/misc.service'
import { StatusCodes } from 'enums/StatusCodes'
import { avatarSeeds } from 'utils/avatar-seeds'
import { RandomService } from 'libs/random.service'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { ConnectWalletDTO, UsernameDTO } from './dto/auth.dto'

@Injectable()
export class AuthService {
    private randomService: RandomService
    private readonly avatarBaseUrl = "https://api.dicebear.com/9.x/bottts/svg"

    constructor(
        private readonly misc: MiscService,
        private readonly prisma: PrismaService,
        private readonly response: ResponseService,
    ) {
        this.randomService = new RandomService('md5')
    }

    async connectWallet(res: Response, { address }: ConnectWalletDTO) {
        let user = await this.prisma.user.findUnique({
            where: { address }
        })

        if (!user) {
            const _id = new ObjectId().toString()

            const { random } = this.randomService.randomize()
            const randomAvatarSeed = avatarSeeds[Math.floor(random * avatarSeeds.length) - 1]
            const avatarUrl = `${this.avatarBaseUrl}?seed=${randomAvatarSeed}`

            await this.prisma.$transaction([
                this.prisma.user.create({
                    data: { id: _id, address, avatar: avatarUrl }
                }),
                this.prisma.stat.create({
                    data: { user: { connect: { id: _id } } }
                })
            ])
        }

        if (user) {
            if (!user.active) {
                return this.response.sendError(res, StatusCodes.Forbidden, "Account has been suspended")
            }

            const access_token = await this.misc.generateAccessToken({
                sub: user.id,
                address: user.address
            })

            return access_token
        }
    }

    async editUsername(
        res: Response,
        { sub }: ExpressUser,
        { username }: UsernameDTO,
    ) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { username }
            })

            if (user) {
                return this.response.sendError(res, StatusCodes.Conflict, "Username has been taken")
            }

            await this.prisma.user.update({
                where: { id: sub },
                data: { username }
            })

            this.response.sendSuccess(res, StatusCodes.OK, {
                data: { username },
                message: "Username has been updated successfully",
            })
        } catch (err) {
            this.misc.handleServerError(res, err)
        }
    }

    async profile(res: Response, { sub }: ExpressUser) {
        const user = await this.prisma.user.findUnique({
            where: { id: sub },
            include: {
                stat: true,
                _count: {
                    select: {
                        rounds: true,
                    }
                }
            }
        })

        const newUser = { ...user, times_played: user._count.rounds, _count: undefined }

        this.response.sendSuccess(res, StatusCodes.OK, { data: newUser })
    }
}
