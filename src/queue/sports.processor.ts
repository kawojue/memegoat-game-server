import {
    Process,
    Processor,
    OnQueueActive,
    OnQueueFailed,
    OnQueueCompleted,
} from '@nestjs/bull'
import { Job } from 'bull'

@Processor('sports-queue')
export class SportsQueueProcessor {
    constructor() { }

    @Process()
    async sportsQueueJob(job: Job) {

    }

    @OnQueueActive()
    onActive(job: Job) {
        console.info(
            `(Queue) Processing: job ${job.id} of ${job.queue.name} with data: ${JSON.stringify(job.data)}...`
        )
    }

    @OnQueueCompleted()
    async OnQueueCompleted(job: Job) {
        console.info(
            '(Queue) Completed: job ',
            job.id,
            job.queue.name,
        )
    }

    @OnQueueFailed()
    OnQueueFailed(job: Job, error: Error) {
        console.info(
            '(Queue) Error on: job ',
            job.id,
            ' -> error: ',
            error.message,
        )
    }
}