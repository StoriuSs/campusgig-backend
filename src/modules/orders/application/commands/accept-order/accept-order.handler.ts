import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { ORDERS_REPOSITORY_PORT, OrderDetail, OrdersRepositoryPort } from '../../../domain/ports'
import { OrderAcceptedEvent } from '../../../domain/events'
import { AcceptOrderCommand } from './accept-order.command'

@CommandHandler(AcceptOrderCommand)
export class AcceptOrderHandler implements ICommandHandler<AcceptOrderCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: AcceptOrderCommand): Promise<OrderDetail> {
        // Repo validates: viewer must be the seller, status must be
        // PendingReview. Inside the same $transaction it flips status,
        // computes deliveryDeadline, removes the AcceptDeadlineJob, schedules
        // the DeliveryDeadlineJob, writes the OrderEvent + system message.
        const order = await this.repo.acceptOrder(command.orderId, command.viewerId)
        this.eventBus.publish(new OrderAcceptedEvent(order, command.viewerId))
        return order
    }
}
