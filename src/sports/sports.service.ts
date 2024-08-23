import { Injectable } from '@nestjs/common'
import { ApiService } from 'libs/api.service'

@Injectable()
export class SportsService {
    constructor(
        private readonly apiService: ApiService
    ) { }

}
