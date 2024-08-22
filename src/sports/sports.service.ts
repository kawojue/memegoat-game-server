import { Injectable } from '@nestjs/common'
import { ApiService } from 'libs/api.service'

@Injectable()
export class SportsService {
    constructor(
        private readonly apiService: ApiService
    ) { }

    async getTimezones() {
        const data = this.apiService.apiSportGET(`timezones`)

        return data
    }

    async getCountries() {
        const data = this.apiService.apiSportGET(`countries`)

        return data
    }
}
