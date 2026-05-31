import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { CommandBus } from '@nestjs/cqrs'
import { Job } from 'bullmq'

import {
    AutoCancelOrderCommand,
    AutoCompleteOrderCommand,
    ExpireCancellationCommand,
    ExpireExtensionCommand,
    FinalizeOrderCommand,
    MarkLateCommand
} from '../../application/commands'
import { ORDERS_DEADLINES_QUEUE } from './order-jobs.scheduler'

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
            case 'delivery-deadline': {
                const { orderId } = job.data as { orderId: string }
                await this.commandBus.execute(new MarkLateCommand(orderId))
                return
            }
            case 'review-deadline': {
                const { orderId } = job.data as { orderId: string }
                await this.commandBus.execute(new AutoCompleteOrderCommand(orderId))
                return
            }
            case 'dispute-deadline': {
                const { orderId } = job.data as { orderId: string }
                await this.commandBus.execute(new FinalizeOrderCommand(orderId))
                return
            }
            case 'extension-expiry': {
                const { extensionId } = job.data as { extensionId: string }
                await this.commandBus.execute(new ExpireExtensionCommand(extensionId))
                return
            }
            case 'cancellation-expiry': {
                const { cancellationId } = job.data as { cancellationId: string }
                await this.commandBus.execute(new ExpireCancellationCommand(cancellationId))
                return
            }
            default:
                this.logger.warn(`Unknown orders-deadlines job kind: ${job.name}`)
                return
        }
    }
}
