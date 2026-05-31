import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { ORDERS_REPOSITORY_PORT, OrdersRepositoryPort } from '../../../domain/ports'
import { CancellationExpiredEvent } from '../../../domain/events'
import { ExpireCancellationCommand } from './expire-cancellation.command'

// Idempotent: repo returns null when cancellation already decided before job fired.
@CommandHandler(ExpireCancellationCommand)
export class ExpireCancellationHandler implements ICommandHandler<ExpireCancellationCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: ExpireCancellationCommand): Promise<void> {
        const result = await this.repo.expireCancellation(command.cancellationId)
        if (result) {
            this.eventBus.publish(new CancellationExpiredEvent(result.order, result.cancellation))
        }
    }
}
