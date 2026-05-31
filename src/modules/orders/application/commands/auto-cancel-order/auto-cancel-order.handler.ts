import { Inject, Logger } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { OrderDetail, OrdersRepositoryPort, ORDERS_REPOSITORY_PORT } from '../../../domain/ports'
import { OrderAutoCancelledEvent } from '../../../domain/events'
import { AutoCancelOrderCommand } from './auto-cancel-order.command'

@CommandHandler(AutoCancelOrderCommand)
export class AutoCancelOrderHandler implements ICommandHandler<AutoCancelOrderCommand> {
    private readonly logger = new Logger(AutoCancelOrderHandler.name)

    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: AutoCancelOrderCommand): Promise<OrderDetail | null> {
        // Null = order already left PendingReview before this job fired — idempotent no-op.
        const order = await this.repo.autoCancelOrder(command.orderId)
        if (!order) {
            this.logger.debug(`AutoCancelOrder no-op for ${command.orderId}: order moved out of PendingReview`)
            return null
        }
        this.eventBus.publish(new OrderAutoCancelledEvent(order, {}))
        return order
    }
}
