import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { DeliveryItem, OrderDetail, OrdersRepositoryPort, ORDERS_REPOSITORY_PORT } from '../../../domain/ports'
import { TooManyDeliveryFilesException } from '../../../domain/exceptions'
import { OrderDeliveryUpdatedEvent } from '../../../domain/events'
import { UpdateDeliveryCommand } from './update-delivery.command'

const MAX_FILES_PER_DELIVERY = 10

@CommandHandler(UpdateDeliveryCommand)
export class UpdateDeliveryHandler implements ICommandHandler<UpdateDeliveryCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: UpdateDeliveryCommand): Promise<OrderDetail> {
        const note = command.note?.trim() ?? ''
        const stagedFileIds = command.stagedFileIds ?? []
        if (stagedFileIds.length > MAX_FILES_PER_DELIVERY) {
            throw new TooManyDeliveryFilesException(stagedFileIds.length, MAX_FILES_PER_DELIVERY)
        }

        // Auto-complete countdown stays anchored to v1's reviewDeadline — re-delivery doesn't reset the clock.
        const result: { order: OrderDetail; delivery: DeliveryItem } = await this.repo.updateDelivery({
            orderId: command.orderId,
            viewerId: command.viewerId,
            note,
            stagedFileIds
        })

        this.eventBus.publish(new OrderDeliveryUpdatedEvent(result.order, result.delivery, command.viewerId))
        return result.order
    }
}
