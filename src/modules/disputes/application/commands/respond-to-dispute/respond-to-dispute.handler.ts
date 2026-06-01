import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { ORDERS_REPOSITORY_PORT, OrdersRepositoryPort } from '@/modules/orders/domain/ports'

import { DISPUTES_REPOSITORY_PORT, DisputesRepositoryPort } from '../../../domain/ports/disputes.repository.port'
import { DisputeUpdatedEvent } from '../../../domain/events'
import { DisputeJobsScheduler } from '../../../infrastructure/jobs/dispute-jobs.scheduler'
import { RespondToDisputeCommand } from './respond-to-dispute.command'

@CommandHandler(RespondToDisputeCommand)
export class RespondToDisputeHandler implements ICommandHandler<RespondToDisputeCommand> {
    constructor(
        @Inject(DISPUTES_REPOSITORY_PORT) private readonly repo: DisputesRepositoryPort,
        @Inject(ORDERS_REPOSITORY_PORT) private readonly ordersRepo: OrdersRepositoryPort,
        private readonly jobs: DisputeJobsScheduler,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: RespondToDisputeCommand): Promise<void> {
        const result = await this.repo.respondToDispute({
            orderId: command.orderId,
            viewerId: command.viewerId,
            statement: command.statement,
            evidenceFileIds: command.evidenceFileIds
        })
        // Counterparty responded — cancel the 48h timeout; it's already at admin review.
        await this.jobs.removeResponseTimeout(result.dispute.id)
        const order = await this.ordersRepo.findByIdForViewer(result.orderId, command.viewerId)
        if (order) this.eventBus.publish(new DisputeUpdatedEvent(order))
    }
}
