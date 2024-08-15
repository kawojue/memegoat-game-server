import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { ApiService } from 'libs/api.service'

@Injectable()
export class CloudflareService {
    private accountId: string
    private projectName: string

    constructor(
        private readonly apiService: ApiService
    ) {
        this.projectName = process.env.PROJECT_NAME
        this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    }

    async getDeployments() {
        try {
            return await this.apiService.cloudflareGET(`/accounts/${this.accountId}/pages/projects/${this.projectName}/deployments`)
        } catch (err) {
            console.error(err.response?.data)
            throw new InternalServerErrorException(err.response.data)
        }
    }

    async createDeployment() {
        try {
            return await this.apiService.cloudflarePOST(`/accounts/${this.accountId}/pages/projects/${this.projectName}/deployments`)
        } catch (err) {
            console.error(err.response?.data)
            throw new InternalServerErrorException(err.response.data)
        }
    }
}
