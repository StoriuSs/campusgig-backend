import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { ORDERS_REPOSITORY_PORT, OrderDetail, OrdersRepositoryPort, MoneyMoveRefs } from '../../../domain/ports'
import { OrderPlacedEvent } from '../../../domain/events'
import { PlaceOrderCommand } from './place-order.command'

@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler implements ICommandHandler<PlaceOrderCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: PlaceOrderCommand): Promise<OrderDetail> {
        // All gig / wallet / seller guards live in the repo's $transaction
        // so the check + side-effects happen under one Serializable lock.
        // Repo throws GigNotPurchasable / InsufficientWalletBalance /
        // SellerCannotOrderOwnGig on the relevant conditions.
        const result: { order: OrderDetail; refs: MoneyMoveRefs } = await this.repo.placeOrder({
            buyerId: command.buyerId,
            gigId: command.gigId,
            idempotencyKey: command.idempotencyKey
        })

        this.eventBus.publish(new OrderPlacedEvent(result.order, result.refs, command.buyerId))
        return result.order
    }
}
