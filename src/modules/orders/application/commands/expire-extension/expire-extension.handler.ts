import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { ORDERS_REPOSITORY_PORT, OrdersRepositoryPort } from '../../../domain/ports'
import { ExtensionExpiredEvent } from '../../../domain/events'
import { ExpireExtensionCommand } from './expire-extension.command'

// Idempotent: repo returns null when extension already decided (buyer acted just before job fired).
@CommandHandler(ExpireExtensionCommand)
export class ExpireExtensionHandler implements ICommandHandler<ExpireExtensionCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: ExpireExtensionCommand): Promise<void> {
        const result = await this.repo.expireExtension(command.extensionId)
        if (result) {
            this.eventBus.publish(new ExtensionExpiredEvent(result.order, result.extension))
        }
    }
}
