import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'

export const DISPUTES_QUEUE = 'disputes-response'

// The 48h counterparty-response window. Separate from the orders queue's
// `dispute-deadline` job (which is the 7-day auto-complete window).
@Injectable()
export class DisputeJobsScheduler {
    private readonly logger = new Logger(DisputeJobsScheduler.name)

    constructor(@InjectQueue(DISPUTES_QUEUE) private readonly queue: Queue) {}

    private jobId(disputeId: string): string {
        return `response-timeout__${disputeId}`
    }

    async scheduleResponseTimeout(disputeId: string, deadline: Date): Promise<void> {
        const delay = Math.max(0, deadline.getTime() - Date.now())
        await this.queue.add(
            'response-timeout',
            { disputeId },
            {
                jobId: this.jobId(disputeId),
                delay,
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: true,
                removeOnFail: 100
            }
        )
    }

    async removeResponseTimeout(disputeId: string): Promise<void> {
        try {
            const job = await this.queue.getJob(this.jobId(disputeId))
            if (job) await job.remove()
        } catch (err) {
            this.logger.debug(`Job remove no-op for response-timeout:${disputeId}: ${(err as Error).message}`)
        }
    }
}
