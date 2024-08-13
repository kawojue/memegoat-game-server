import { Injectable } from '@nestjs/common'
import { ApiService } from 'libs/api.service'

@Injectable()
export class SportsService {
    constructor(
        private readonly apiService: ApiService
    ) { }

    async inPlayLivescore() {
        const data = this.apiService.apiSportGET(`https://v3.football.api-sports.io/fixtures?live=all`)

        return data
    }
}
