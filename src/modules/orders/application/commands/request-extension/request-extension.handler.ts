import { BadRequestException, Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { ExtensionItem, OrderDetail, ORDERS_REPOSITORY_PORT, OrdersRepositoryPort } from '../../../domain/ports'
import { ExtensionRequestedEvent } from '../../../domain/events'
import { RequestExtensionCommand } from './request-extension.command'

// Only these four values are valid — matches the four UI radio presets.
const ALLOWED_HOURS = [12, 24, 48, 72] as const

const MAX_REASON_LENGTH = 500

@CommandHandler(RequestExtensionCommand)
export class RequestExtensionHandler implements ICommandHandler<RequestExtensionCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: RequestExtensionCommand): Promise<OrderDetail> {
        if (!ALLOWED_HOURS.includes(command.hoursRequested as 12 | 24 | 48 | 72)) {
            throw new BadRequestException(`hoursRequested must be one of ${ALLOWED_HOURS.join(', ')}`)
        }
        const reason = command.reason?.trim() ?? null
        if (reason && reason.length > MAX_REASON_LENGTH) {
            throw new BadRequestException(`reason must be ${MAX_REASON_LENGTH} characters or fewer`)
        }

        const result: { order: OrderDetail; extension: ExtensionItem } = await this.repo.requestExtension({
            orderId: command.orderId,
            viewerId: command.viewerId,
            hoursRequested: command.hoursRequested,
            reason
        })

        this.eventBus.publish(new ExtensionRequestedEvent(result.order, result.extension, command.viewerId))
        return result.order
    }
}
