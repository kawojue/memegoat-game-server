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
    stake: number
    points: number
    board: string[][]
}

interface Card {
    suit: string
    value: string
}

type HiroChannel = 'mainnet' | 'testnet'

interface FootballMatchResponse {
    fixture: {
        id: number
        referee: string | null
        timezone: string
        date: string
        timestamp: number
        periods: {
            first: number | null
            second: number | null
        }
        venue: {
            id: number | null
            name: string
            city: string
        }
        status: {
            long: string
            short: string
            elapsed: number
        }
    }
    league: {
        id: number
        name: string
        country: string
        logo: string
        flag: string
        season: number
        round: string
    }
    teams: {
        home: {
            id: number
            name: string
            logo: string
            winner: boolean | null
        }
        away: {
            id: number
            name: string
            logo: string
            winner: boolean | null
        }
    }
    goals: {
        home: number
        away: number
    }
    score: {
        halftime: {
            home: number
            away: number
        }
        fulltime: {
            home: number | null
            away: number | null
        }
        extratime: {
            home: number | null
            away: number | null
        }
        penalty: {
            home: number | null
            away: number | null
        }
    }
    events: Array<{
        time: {
            elapsed: number
            extra: number | null
        }
        team: {
            id: number
            name: string
            logo: string
        }
        player: {
            id: number
            name: string
        }
        assist: {
            id: number | null
            name: string | null
        }
        type: string
        detail: string
        comments: string | null
    }>
}
