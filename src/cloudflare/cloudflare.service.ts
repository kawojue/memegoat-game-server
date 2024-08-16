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
            return await this.apiService.cloudflareGET(`${this.accountId}/pages/projects/${this.projectName}/deployments`)
        } catch (err) {
            console.error(err.response?.data)
            throw new InternalServerErrorException(err.response.data)
        }
    }

    async createDeployment() {
        try {
            return await this.apiService.cloudflarePOST(`${this.accountId}/pages/projects/${this.projectName}/deployments`)
        } catch (err) {
            console.error(err.response?.data)
            throw new InternalServerErrorException(err.response.data)
        }
    }

    async getDeploymentInfo(deploymentId: string) {
        try {
            return await this.apiService.cloudflareGET(`${this.accountId}/pages/projects/${this.projectName}/deployments/${deploymentId}`)
        } catch (err) {
            console.error(err.response?.data)
            throw new InternalServerErrorException(err.response.data)
        }
    }

    async retryDeployment(deploymentId: string) {
        try {
            return await this.apiService.cloudflareGET(`${this.accountId}/pages/projects/${this.projectName}/deployments/${deploymentId}/retry`)
        } catch (err) {
            console.error(err.response?.data)
            throw new InternalServerErrorException(err.response.data)
        }
    }
}
