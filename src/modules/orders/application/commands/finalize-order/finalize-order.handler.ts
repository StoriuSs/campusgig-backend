import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { MoneyMoveRefs, OrderDetail, ORDERS_REPOSITORY_PORT, OrdersRepositoryPort } from '../../../domain/ports'
import { OrderFinalizedEvent } from '../../../domain/events'
import { FinalizeOrderCommand } from './finalize-order.command'

// Releases funds 80/20 (seller/platform), transitions AwaitingFinalization → Completed. Idempotent.
@CommandHandler(FinalizeOrderCommand)
export class FinalizeOrderHandler implements ICommandHandler<FinalizeOrderCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: FinalizeOrderCommand): Promise<void> {
        const result: { order: OrderDetail; refs: MoneyMoveRefs } | null = await this.repo.finalizeOrder(
            command.orderId
        )
        if (result) {
            this.eventBus.publish(new OrderFinalizedEvent(result.order, result.refs))
        }
    }
}
