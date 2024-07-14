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
    private isProd: boolean
    private randomService: RandomService
    private readonly avatarBaseUrl = "https://api.dicebear.com/9.x/bottts/svg"

    constructor(
        private readonly misc: MiscService,
        private readonly prisma: PrismaService,
        private readonly response: ResponseService,
    ) {
        this.randomService = new RandomService('md5')
        this.isProd = process.env.NODE_ENV === "production"
    }

    async connectWallet(res: Response, { address }: ConnectWalletDTO) {
        try {
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
                res.cookie('access_token', access_token, {
                    sameSite: this.isProd ? 'none' : 'lax',
                    secure: this.isProd,
                    maxAge: 120 * 24 * 60 * 60 * 1000,
                })

                res.redirect(process.env.REDIRECT_URL || 'http://localhost:5173/games')
            }
        } catch (err) {
            this.misc.handleServerError(res, err)
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
}
