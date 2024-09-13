import {
    Injectable,
    NestMiddleware,
    UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { env } from 'configs/env.config'
import { NextFunction, Request, Response } from 'express'

@Injectable()
export class CustomAuthMiddleware implements NestMiddleware {
    constructor(private readonly jwtService: JwtService) { }

    private async validateAndDecodeToken(token: string) {
        try {
            return await this.jwtService.verifyAsync(token, {
                ignoreExpiration: false,
                secret: env.jwt.secret,
            })
        } catch {
            return null
        }
    }

    async use(req: Request, res: Response, next: NextFunction) {
        let token: string | undefined

        const authHeader = req.headers.authorization

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1]
        }

        if (token) {
            const decodedToken = await this.validateAndDecodeToken(token)
            if (decodedToken) {
                req.user = decodedToken
            } else {
                throw new UnauthorizedException('Invalid or expired token')
            }
        }

        next()
    }
}