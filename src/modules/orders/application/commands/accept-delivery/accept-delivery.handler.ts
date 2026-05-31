import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { MoneyMoveRefs, OrderDetail, OrdersRepositoryPort, ORDERS_REPOSITORY_PORT } from '../../../domain/ports'
import { OrderAcceptedDeliveryEvent, OrderFinalizedEvent } from '../../../domain/events'
import { AcceptDeliveryCommand } from './accept-delivery.command'

@CommandHandler(AcceptDeliveryCommand)
export class AcceptDeliveryHandler implements ICommandHandler<AcceptDeliveryCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: AcceptDeliveryCommand): Promise<OrderDetail> {
        // Buyer can also approve during the 7-day AwaitingFinalization window (early accept path).
        const result: { order: OrderDetail; refs: MoneyMoveRefs } = await this.repo.acceptDelivery(
            command.orderId,
            command.viewerId
        )

        this.eventBus.publish(new OrderAcceptedDeliveryEvent(result.order, result.refs, command.viewerId))
        this.eventBus.publish(new OrderFinalizedEvent(result.order, result.refs))
        return result.order
    }
}
