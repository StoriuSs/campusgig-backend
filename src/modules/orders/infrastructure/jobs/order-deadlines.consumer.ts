import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { CommandBus } from '@nestjs/cqrs'
import { Job } from 'bullmq'

import { AutoCancelOrderCommand } from '../../application/commands/auto-cancel-order'
import { ORDERS_DEADLINES_QUEUE } from './order-jobs.scheduler'

// Single processor handles every deadline job kind for the orders module.
// `name` on the job (set when added) selects the right command dispatch.
// Each branch is idempotent at the repo level — the matching command's
// repo method status-guards and returns null if the order has already
// moved out of the source state.
@Processor(ORDERS_DEADLINES_QUEUE)
export class OrderDeadlinesConsumer extends WorkerHost {
    private readonly logger = new Logger(OrderDeadlinesConsumer.name)

    constructor(private readonly commandBus: CommandBus) {
        super()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async process(job: Job<any, void, string>): Promise<void> {
        this.logger.debug(`Processing order deadline job ${job.name} ${job.id}`)

        switch (job.name) {
            case 'accept-deadline': {
                const { orderId } = job.data as { orderId: string }
                await this.commandBus.execute(new AutoCancelOrderCommand(orderId))
                return
            }
            // Phase-2 kinds — handlers added in T82–T91. Until then, log and
            // swallow so a stale queued job doesn't fail loudly.
            case 'delivery-deadline':
            case 'review-deadline':
            case 'dispute-deadline':
            case 'extension-expiry':
            case 'cancellation-expiry':
                this.logger.warn(`Phase-2 job kind '${job.name}' arrived in Phase-1 build — ignoring`)
                return
            default:
                this.logger.warn(`Unknown orders-deadlines job kind: ${job.name}`)
                return
        }
    }
}
