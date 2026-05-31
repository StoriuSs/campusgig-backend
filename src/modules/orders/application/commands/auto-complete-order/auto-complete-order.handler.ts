import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { ORDERS_REPOSITORY_PORT, OrdersRepositoryPort } from '../../../domain/ports'
import { OrderAutoCompletedEvent } from '../../../domain/events'
import { AutoCompleteOrderCommand } from './auto-complete-order.command'

// Transitions Delivered → AwaitingFinalization. No funds move yet — release happens after the 7-day dispute window.
@CommandHandler(AutoCompleteOrderCommand)
export class AutoCompleteOrderHandler implements ICommandHandler<AutoCompleteOrderCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: AutoCompleteOrderCommand): Promise<void> {
        const updated = await this.repo.autoCompleteOrder(command.orderId)
        if (updated) {
            this.eventBus.publish(new OrderAutoCompletedEvent(updated))
        }
    }
}
