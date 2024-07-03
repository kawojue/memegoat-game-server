import { Response } from 'express'
import { JwtService } from '@nestjs/jwt'
import { Injectable } from '@nestjs/common'
import { StatusCodes } from 'enums/StatusCodes'
import { ResponseService } from './response.service'

@Injectable()
export class MiscService {
    private response: ResponseService

    constructor(readonly jwtService: JwtService) {
        this.response = new ResponseService()
    }

    async generateAccessToken({ sub, address }: JwtPayload): Promise<string> {
        return await this.jwtService.signAsync({ sub, address }, {
            expiresIn: '10m',
            secret: process.env.JWT_SECRET,
        })
    }

    async generateRefreshToken({ sub, address }: JwtPayload): Promise<string> {
        return await this.jwtService.signAsync({ sub, address }, {
            expiresIn: '120d',
            secret: process.env.JWT_SECRET,
        })
    }

    async generateNewAccessToken(refreshToken: string): Promise<string> {
        try {
            const { sub, address } = this.jwtService.verify(refreshToken, {
                secret: process.env.JWT_SECRET,
            })

            return await this.generateAccessToken({ sub, address })
        } catch (err) {
            throw err
        }
    }

    async verifyToken(token: string): Promise<any> {
        try {
            return await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET })
        } catch (error) {
            throw new Error('Invalid token')
        }
    }

    handleServerError(res: Response, err?: any, msg?: string) {
        console.error(err)
        return this.response.sendError(res, StatusCodes.InternalServerError, msg || err?.message || 'Something went wrong')
    }
}