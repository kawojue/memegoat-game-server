import {
  Injectable,
  HttpException,
} from '@nestjs/common'
import { env } from 'configs/env.config'
import { lastValueFrom, map } from 'rxjs'
import { HttpService } from '@nestjs/axios'

@Injectable()
export class ApiService {
  private ApiURLS = {
    testnet: {
      getTxnInfo: 'https://api.testnet.hiro.so/extended/v1/tx/',
    },
    mainnet: {
      getTxnInfo: 'https://api.mainnet.hiro.so/extended/v1/tx/',
    },
  }

  constructor(private readonly httpService: HttpService) { }

  async GET<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const observable = this.httpService.get<T>(url, { headers }).pipe(
      map(response => response.data)
    )
    return lastValueFrom(observable)
  }

  async POST<T>(url: string, data: any, headers?: Record<string, string>): Promise<T> {
    const observable = this.httpService.post<T>(url, data, { headers }).pipe(
      map(response => response.data)
    )
    return lastValueFrom(observable)
  }

  apiSportGET<T>(path: string) {
    try {
      return this.GET<T>(`https://v3.football.api-sports.io/${path}`, {
        'x-rapidapi-key': env.sport.apiKey,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      })
    } catch (err) {
      if (err.response.data?.message) {
        throw new HttpException(err.response.data.message, err.response.status)
      } else {
        throw new HttpException('Something went wrong', 502)
      }
    }
  }

  fetchTransaction<T>(network: HiroChannel, txnId: string) {
    return this.GET<T>(
      `${this.ApiURLS[network].getTxnInfo}${txnId}`,
      {
        'Content-Type': 'application/json',
        'x-api-key': env.hiro.apiKey,
      },
    )
  }
}
