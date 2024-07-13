type AlgoType = 'sha256' | 'md5'

interface JwtPayload {
    sub: string
    address: string
}

interface ExpressUser extends Express.User {
    sub: string
    address: string
}

interface IRequest extends Request {
    user: ExpressUser
}