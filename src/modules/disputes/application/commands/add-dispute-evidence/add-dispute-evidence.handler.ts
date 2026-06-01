import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { ORDERS_REPOSITORY_PORT, OrdersRepositoryPort } from '@/modules/orders/domain/ports'

import { DISPUTES_REPOSITORY_PORT, DisputesRepositoryPort } from '../../../domain/ports/disputes.repository.port'
import { DisputeUpdatedEvent } from '../../../domain/events'
import { AddDisputeEvidenceCommand } from './add-dispute-evidence.command'

@CommandHandler(AddDisputeEvidenceCommand)
export class AddDisputeEvidenceHandler implements ICommandHandler<AddDisputeEvidenceCommand> {
    constructor(
        @Inject(DISPUTES_REPOSITORY_PORT) private readonly repo: DisputesRepositoryPort,
        @Inject(ORDERS_REPOSITORY_PORT) private readonly ordersRepo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: AddDisputeEvidenceCommand): Promise<void> {
        const result = await this.repo.addEvidence({
            orderId: command.orderId,
            viewerId: command.viewerId,
            evidenceFileIds: command.evidenceFileIds
        })
        const order = await this.ordersRepo.findByIdForViewer(result.orderId, command.viewerId)
        if (order) this.eventBus.publish(new DisputeUpdatedEvent(order))
    }
}
