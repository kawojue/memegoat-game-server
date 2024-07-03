import { Request, Response } from 'express'
import { Injectable } from '@nestjs/common'
import { MiscService } from 'libs/misc.service'
import { StatusCodes } from 'enums/StatusCodes'
import { PrismaService } from 'prisma/prisma.service'
import { ResponseService } from 'libs/response.service'
import { ConnectWalletDTO, UsernameDTO } from './dto/auth.dto'

@Injectable()
export class AuthService {
    private readonly isProd: boolean

    constructor(
        private readonly misc: MiscService,
        private readonly prisma: PrismaService,
        private readonly response: ResponseService,
    ) {
        this.isProd = process.env.NODE_ENV === "production"
    }

    async connectWallet(res: Response, { address }: ConnectWalletDTO) {
        try {
            let user = await this.prisma.user.findUnique({
                where: { address }
            })

            if (!user) {
                user = await this.prisma.user.create({
                    data: { address }
                })
            }

            if (user) {
                if (!user.active) {
                    return this.response.sendError(res, StatusCodes.Forbidden, "Account has been suspended")
                }

                const payload: JwtPayload = {
                    sub: user.id,
                    address: user.address
                }

                const access_token = await this.misc.generateAccessToken(payload)
                const refresh_token = await this.misc.generateRefreshToken(payload)

                await this.prisma.user.update({
                    where: { id: user.id },
                    data: { refresh_token }
                })

                res.cookie('access_token', access_token, {
                    sameSite: this.isProd ? 'none' : 'lax',
                    secure: this.isProd,
                    maxAge: 10 * 60 * 1000,
                })

                res.cookie('refresh_token', refresh_token, {
                    httpOnly: true,
                    sameSite: this.isProd ? 'none' : 'lax',
                    secure: this.isProd,
                    maxAge: 120 * 24 * 60 * 60 * 1000,
                })

                res.redirect('http://localhost:3000/games')
            }
        } catch (err) {
            this.misc.handleServerError(res, err)
        }
    }

    async refreshAccessToken(req: Request, res: Response) {
        const refresh_token = req.cookies?.refresh_token

        if (!refresh_token) {
            return this.response.sendError(res, StatusCodes.Forbidden, "Refresh token does not exist")
        }

        try {
            const user = await this.prisma.user.findFirst({
                where: { refresh_token }
            })

            if (!user) {
                return this.response.sendError(res, StatusCodes.NotFound, "User not found")
            }

            const access_token = await this.misc.generateNewAccessToken(refresh_token)
            res.cookie('access_token', access_token, {
                sameSite: this.isProd ? 'none' : 'lax',
                secure: this.isProd,
                maxAge: 10 * 60 * 1000,
            })

            this.response.sendSuccess(res, StatusCodes.OK, { access_token })
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
