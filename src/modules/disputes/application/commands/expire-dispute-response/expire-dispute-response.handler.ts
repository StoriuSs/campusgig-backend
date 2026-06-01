import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { ORDERS_REPOSITORY_PORT, OrdersRepositoryPort } from '@/modules/orders/domain/ports'

import { DISPUTES_REPOSITORY_PORT, DisputesRepositoryPort } from '../../../domain/ports/disputes.repository.port'
import { DisputeUpdatedEvent } from '../../../domain/events'
import { ExpireDisputeResponseCommand } from './expire-dispute-response.command'

// Job-fired at the 48h deadline. Idempotent: no-op if the counterparty already
// responded (the dispute is no longer AwaitingResponse).
@CommandHandler(ExpireDisputeResponseCommand)
export class ExpireDisputeResponseHandler implements ICommandHandler<ExpireDisputeResponseCommand> {
    constructor(
        @Inject(DISPUTES_REPOSITORY_PORT) private readonly repo: DisputesRepositoryPort,
        @Inject(ORDERS_REPOSITORY_PORT) private readonly ordersRepo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: ExpireDisputeResponseCommand): Promise<void> {
        const result = await this.repo.expireResponse(command.disputeId)
        if (!result) return
        const order = await this.ordersRepo.findByIdForViewer(result.orderId, result.dispute.filedByUserId)
        if (order) this.eventBus.publish(new DisputeUpdatedEvent(order))
    }
}
