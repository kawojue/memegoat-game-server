import { Response } from 'express'
import { JwtService } from '@nestjs/jwt'
import { env } from 'configs/env.config'
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
    return await this.jwtService.signAsync(
      { sub, address },
      {
        expiresIn: env.jwt.expiry,
        secret: env.jwt.secret,
      },
    )
  }

  handleServerError(res: Response, err?: any, msg?: string) {
    console.error(err)
    return this.response.sendError(
      res,
      StatusCodes.InternalServerError,
      msg || err?.message || 'Something went wrong',
    )
  }
}
