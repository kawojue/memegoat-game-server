import { Server } from 'socket.io'
import { Injectable } from '@nestjs/common'

@Injectable()
export class RealtimeService {
    private server: Server

    setServer(server: Server) {
        this.server = server
    }

    getServer(): Server {
        return this.server
    }

    validateBetValue(betType: string, betValue: any): boolean {
        const validBetValues = {
            single: (value: number) => typeof value === 'number' && value >= 0 && value <= 36,
            red: (value: string) => value === 'red',
            black: (value: string) => value === 'black',
            odd: (value: string) => value === 'odd',
            even: (value: string) => value === 'even',
        } as const;

        return validBetValues[betType](betValue as any);
    }
}