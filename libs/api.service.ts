import {
  Injectable,
  HttpException,
  BadGatewayException,
} from '@nestjs/common'
import { lastValueFrom, map } from 'rxjs'
import { HttpService } from '@nestjs/axios'

@Injectable()
export class ApiService {
  private apiKey: string
  private baseUrl: string
  private apiEmail: string
  private ApiURLS = {
    testnet: {
      getTxnInfo: 'https://api.testnet.hiro.so/extended/v1/tx/',
    },
    mainnet: {
      getTxnInfo: 'https://api.mainnet.hiro.so/extended/v1/tx/',
    },
  }

  constructor(private readonly httpService: HttpService) {
    this.apiKey = process.env.CLOUDFLARE_API_KEY
    this.apiEmail = process.env.CLOUDFLARE_API_EMAIL
    this.baseUrl = `https://api.cloudflare.com/client/v4`
  }

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

  apiSportGET<T>(url: string) {
    try {
      return this.GET<T>(url, {
        'x-rapidapi-key': process.env.SPORT_API_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      })
    } catch (err) {
      if (err?.response?.data?.message) {
        throw new HttpException(err.response.data.message, err.response.status)
      } else {
        throw new BadGatewayException('Something went wrong')
      }
    }
  }

  fetchTransaction<T>(network: HiroChannel, txnId: string) {
    return this.GET<T>(
      `${this.ApiURLS[network].getTxnInfo}${txnId}`,
      {
        'Content-Type': 'application/json',
        'x-api-key': process.env.HIRO_API_KEY,
      },
    )
  }

  cloudflarePOST<T>(url: string, data?: any) {
    return this.POST<T>(`${this.baseUrl}/${url}`, data, {
      'X-Auth-Key': this.apiKey,
      'X-Auth-Email': this.apiEmail,
      'Content-Type': 'application/json'
    })
  }

  cloudflareGET<T>(url: string) {
    return this.GET<T>(`${this.baseUrl}/${url}`, {
      'X-Auth-Key': this.apiKey,
      'X-Auth-Email': this.apiEmail,
      'Content-Type': 'application/json'
    })
  }
}
