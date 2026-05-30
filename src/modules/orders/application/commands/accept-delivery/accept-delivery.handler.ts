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
        // Allowed from `Delivered` OR `AwaitingFinalization` (the buyer can
        // approve early during the 7-day dispute window). Repo handles the
        // status guard, the 80/20 split via releaseFromEscrow, the Earning +
        // PlatformFee Transaction rows, the ReviewDeadlineJob +
        // DisputeDeadlineJob removal, and the OrderEvent + system message.
        const result: { order: OrderDetail; refs: MoneyMoveRefs } = await this.repo.acceptDelivery(
            command.orderId,
            command.viewerId
        )

        // Two events: AcceptedDelivery is the user-action event (used for
        // analytics / "your seller accepted" notifications later); Finalized
        // is the money-settled event (used by wallet cache invalidation,
        // dashboards, etc.).
        this.eventBus.publish(new OrderAcceptedDeliveryEvent(result.order, result.refs, command.viewerId))
        this.eventBus.publish(new OrderFinalizedEvent(result.order, result.refs))
        return result.order
    }
}
