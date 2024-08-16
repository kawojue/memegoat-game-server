import {
    Injectable,
    CanActivate,
    ExecutionContext,
} from '@nestjs/common'
import * as crypto from 'crypto'


const generateKey = async () => {
    const timestamp = Date.now().toString()
    const clientSecret = process.env.DEPLOYMENT_KEY

    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(clientSecret),
        { name: 'HMAC', hash: { name: 'SHA-256' } },
        false,
        ['sign']
    )

    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(timestamp)
    )

    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))

    return {
        'x-signature': encodedSignature,
        'x-timestamp': timestamp,
    }
}

@Injectable()
export class SignatureAuthGuard implements CanActivate {
    private readonly serverSecret = process.env.DEPLOYMENT_KEY

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest()
        const signature = request.headers['x-signature']
        const timestamp = request.headers['x-timestamp']

        if (!signature || !timestamp) {
            return false
        }

        const now = Date.now()
        if (Math.abs(now - Number(timestamp)) > 5 * 60 * 1000) {
            return false
        }

        const hmac = crypto.createHmac('sha256', this.serverSecret)
        const expectedSignature = hmac.update(timestamp).digest('base64')

        if (expectedSignature === signature) {
            return true
        }

        return false
    }
}
