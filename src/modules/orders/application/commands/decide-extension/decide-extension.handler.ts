import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { ExtensionItem, OrderDetail, ORDERS_REPOSITORY_PORT, OrdersRepositoryPort } from '../../../domain/ports'
import { ExtensionDecidedEvent } from '../../../domain/events'
import { DecideExtensionCommand } from './decide-extension.command'

@CommandHandler(DecideExtensionCommand)
export class DecideExtensionHandler implements ICommandHandler<DecideExtensionCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: DecideExtensionCommand): Promise<OrderDetail> {
        const result: { order: OrderDetail; extension: ExtensionItem } = await this.repo.decideExtension({
            extensionId: command.extensionId,
            viewerId: command.viewerId,
            decision: command.decision
        })

        this.eventBus.publish(
            new ExtensionDecidedEvent(result.order, result.extension, command.viewerId, command.decision)
        )
        return result.order
    }
}
