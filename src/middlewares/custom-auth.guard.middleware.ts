import { JwtService } from '@nestjs/jwt'
import { env } from 'configs/env.config'
import { NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'

export class CustomAuthMiddlware implements NestMiddleware {
    constructor(private readonly jwtService: JwtService) { }

    private async validateAndDecodeToken(token: string) {
        try {
            return await this.jwtService.verifyAsync(token, {
                ignoreExpiration: false,
                secret: env.jwt.secret
            })
        } catch {
            return null
        }
    }

    async use(req: Request, res: Response, next: NextFunction) {
        let bearerToken: string
        const authHeader = req.headers.authorization
        const cookieToken = req.cookies?.access_token
        const token = cookieToken || authHeader

        if (authHeader) {
            bearerToken = authHeader.split(' ')[1]
        }
        if (token) {
            const decodedToken = await this.validateAndDecodeToken(token)
            if (decodedToken) {
                req.user = decodedToken
            }
        }

        next()
    }
}