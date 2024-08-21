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

interface BlindBox {
    points: number
    board: string[][]
}

interface Card {
    suit: string
    value: string
}

type HiroChannel = 'mainnet' | 'testnet'