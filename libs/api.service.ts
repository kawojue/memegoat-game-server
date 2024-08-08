import {
  Injectable,
  HttpException,
  BadGatewayException,
} from '@nestjs/common'
import { lastValueFrom } from 'rxjs'
import { HttpService } from '@nestjs/axios'

@Injectable()
export class ApiService {
  constructor(private readonly httpService: HttpService) { }

  async get(url: string) {
    try {
      const response = this.httpService.get(url, {
        headers: {
          'x-rapidapi-key': process.env.SPORT_API_KEY,
          'x-rapidapi-host': 'v3.football.api-sports.io',
        },
      })
      const result = await lastValueFrom(response)

      return result.data
    } catch (err) {
      if (err?.response?.data?.message) {
        throw new HttpException(err.response.data.message, err.response.status)
      } else {
        throw new BadGatewayException('Something went wrong')
      }
    }
  }

  private ApiURLS = {
    testnet: {
      getTxnInfo: 'https://api.testnet.hiro.so/extended/v1/tx/',
    },
    mainnet: {
      getTxnInfo: 'https://api.mainnet.hiro.so/extended/v1/tx/',
    },
  }

  async fetchTransaction(network: HiroChannel, txnId: string) {
    const response = this.httpService.get(
      `${this.ApiURLS[network].getTxnInfo}${txnId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.HIRO_API_KEY,
        },
      },
    )
    const result = await lastValueFrom(response)

    return result.data
  }
}
