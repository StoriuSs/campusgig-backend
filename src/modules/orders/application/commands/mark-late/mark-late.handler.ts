import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { ORDERS_REPOSITORY_PORT, OrdersRepositoryPort } from '../../../domain/ports'
import { OrderMarkedLateEvent } from '../../../domain/events'
import { MarkLateCommand } from './mark-late.command'

// Idempotent: repo returns null when order already left InProgress before job fired.
@CommandHandler(MarkLateCommand)
export class MarkLateHandler implements ICommandHandler<MarkLateCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: MarkLateCommand): Promise<void> {
        const updated = await this.repo.markLate(command.orderId)
        if (updated) {
            this.eventBus.publish(new OrderMarkedLateEvent(updated))
        }
    }
}
