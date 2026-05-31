import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'

export const ORDERS_DEADLINES_QUEUE = 'orders-deadlines'

export type OrderDeadlineJobKind =
    | 'accept-deadline'
    | 'delivery-deadline'
    | 'review-deadline'
    | 'dispute-deadline'
    | 'extension-expiry'
    | 'cancellation-expiry'

@Injectable()
export class OrderJobsScheduler {
    private readonly logger = new Logger(OrderJobsScheduler.name)

    constructor(@InjectQueue(ORDERS_DEADLINES_QUEUE) private readonly queue: Queue) {}

    private jobId(kind: OrderDeadlineJobKind, entityId: string): string {
        // `__` separator: BullMQ uses `:` internally for Redis key segments.
        return `${kind}__${entityId}`
    }

    private async addDelayedJob(
        kind: OrderDeadlineJobKind,
        entityId: string,
        deadline: Date,
        payload: Record<string, unknown>
    ): Promise<void> {
        const delay = Math.max(0, deadline.getTime() - Date.now())
        await this.queue.add(kind, payload, {
            jobId: this.jobId(kind, entityId),
            delay,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: true,
            removeOnFail: 100
        })
    }

    private async removeJob(kind: OrderDeadlineJobKind, entityId: string): Promise<void> {
        try {
            const job = await this.queue.getJob(this.jobId(kind, entityId))
            if (job) await job.remove()
        } catch (err) {
            this.logger.debug(`Job remove no-op for ${kind}:${entityId}: ${(err as Error).message}`)
        }
    }

    scheduleAcceptDeadline(orderId: string, deadline: Date): Promise<void> {
        return this.addDelayedJob('accept-deadline', orderId, deadline, { orderId })
    }

    removeAcceptDeadline(orderId: string): Promise<void> {
        return this.removeJob('accept-deadline', orderId)
    }

    scheduleDeliveryDeadline(orderId: string, deadline: Date): Promise<void> {
        return this.addDelayedJob('delivery-deadline', orderId, deadline, { orderId })
    }
    removeDeliveryDeadline(orderId: string): Promise<void> {
        return this.removeJob('delivery-deadline', orderId)
    }

    scheduleReviewDeadline(orderId: string, deadline: Date): Promise<void> {
        return this.addDelayedJob('review-deadline', orderId, deadline, { orderId })
    }
    removeReviewDeadline(orderId: string): Promise<void> {
        return this.removeJob('review-deadline', orderId)
    }

    scheduleDisputeDeadline(orderId: string, deadline: Date): Promise<void> {
        return this.addDelayedJob('dispute-deadline', orderId, deadline, { orderId })
    }
    removeDisputeDeadline(orderId: string): Promise<void> {
        return this.removeJob('dispute-deadline', orderId)
    }

    scheduleExtensionExpiry(extensionId: string, deadline: Date): Promise<void> {
        return this.addDelayedJob('extension-expiry', extensionId, deadline, {
            extensionId
        })
    }
    removeExtensionExpiry(extensionId: string): Promise<void> {
        return this.removeJob('extension-expiry', extensionId)
    }

    scheduleCancellationExpiry(cancellationId: string, deadline: Date): Promise<void> {
        return this.addDelayedJob('cancellation-expiry', cancellationId, deadline, {
            cancellationId
        })
    }
    removeCancellationExpiry(cancellationId: string): Promise<void> {
        return this.removeJob('cancellation-expiry', cancellationId)
    }
}
