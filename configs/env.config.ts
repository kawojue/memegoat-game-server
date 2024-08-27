import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({
    path: path.resolve(process.cwd(), './.env'),
})

export const env = {
    db: {
        url: process.env.DATABASE_URL
    },
    jwt: {
        secret: process.env.JWT_SECRET,
        expiry: process.env.JWT_EXPIRY,
    },
    sport: {
        apiKey: process.env.SPORT_API_KEY,
    },
    webhook: {
        secret: process.env.WEBHOOK_SECRET
    },
    hiro: {
        apiKey: process.env.HIRO_API_KEY,
        channel: process.env.HIRO_CHANNEL as HiroChannel,
    },
    redis: {
        host: process.env.REDIS_HOST,
        username: process.env.REDIS_USERNAME,
        password: process.env.REDIS_PASSWORD,
        port: parseInt(process.env.REDIS_PORT, 10),
    },
    auth: {
        key: process.env.AUTH_SECRET_KEY
    },
    genKey: process.env.GEN_KEY,
    redirectUrl: process.env.REDIRECT_URL,
    isProd: process.env.NODE_ENV === "production",
}