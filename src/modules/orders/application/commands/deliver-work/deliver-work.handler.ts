import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { DeliveryItem, OrderDetail, OrdersRepositoryPort, ORDERS_REPOSITORY_PORT } from '../../../domain/ports'
import { TooManyDeliveryFilesException } from '../../../domain/exceptions'
import { OrderDeliveredEvent } from '../../../domain/events'
import { DeliverWorkCommand } from './deliver-work.command'

const MAX_FILES_PER_DELIVERY = 10

@CommandHandler(DeliverWorkCommand)
export class DeliverWorkHandler implements ICommandHandler<DeliverWorkCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: DeliverWorkCommand): Promise<OrderDetail> {
        const note = command.note?.trim() ?? ''
        const stagedFileIds = command.stagedFileIds ?? []
        if (stagedFileIds.length > MAX_FILES_PER_DELIVERY) {
            throw new TooManyDeliveryFilesException(stagedFileIds.length, MAX_FILES_PER_DELIVERY)
        }

        const result: { order: OrderDetail; delivery: DeliveryItem } = await this.repo.deliverWork({
            orderId: command.orderId,
            viewerId: command.viewerId,
            note,
            stagedFileIds
        })

        this.eventBus.publish(new OrderDeliveredEvent(result.order, result.delivery, command.viewerId))
        return result.order
    }
}
