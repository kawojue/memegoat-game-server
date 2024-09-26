import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common'
import * as crypto from 'crypto'
import { Request } from 'express'
import { env } from 'configs/env.config'

const sign = (text: string, key: string) => {
  return crypto.createHmac('sha256', Buffer.from(key, 'hex'))
    .update(text)
    .digest('hex')
}

@Injectable()
export class CloudinaryApiGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const ctx = context.switchToHttp().getRequest<Request>()

    const receivedSignedKey = ctx.headers['cloudinary-api-key'] as string

    const apiBase64Key = Buffer.from(env.cloudinary.api_key).toString('base64')
    const signedBase64Key = sign(apiBase64Key, env.cloudinary.api_secret)

    if (receivedSignedKey === signedBase64Key) {
      return true
    }

    return false
  }
}
