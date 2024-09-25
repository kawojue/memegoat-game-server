import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common'
import { Request } from 'express'
import { env } from 'configs/env.config'

@Injectable()
export class CloudinaryApiGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const ctx = context.switchToHttp().getRequest<Request>()

    const base64ApiKey = ctx.headers['cloudinary-api-key'] as string

    const Apibase64Key = Buffer.from(env.cloudinary.api_key).toString('base64')

    if (Apibase64Key === base64ApiKey) {
      return true
    }

    return false
  }
}
