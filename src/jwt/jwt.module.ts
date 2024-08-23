import { Module } from '@nestjs/common'
import { env } from 'configs/env.config'
import { JwtStrategy } from './jwt.strategy'
import { JwtModule as NestJwtModule } from '@nestjs/jwt'

@Module({
    imports: [
        NestJwtModule.register({
            secret: env.jwt.secret,
            signOptions: { expiresIn: env.jwt.expiry },
            global: true,
        }),
    ],
    providers: [JwtStrategy],
    exports: [NestJwtModule],
})
export class JwtModule { }