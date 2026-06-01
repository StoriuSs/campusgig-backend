import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { ORDERS_REPOSITORY_PORT, OrdersRepositoryPort } from '@/modules/orders/domain/ports'

import { DISPUTES_REPOSITORY_PORT, DisputesRepositoryPort } from '../../../domain/ports/disputes.repository.port'
import { DisputeFiledEvent } from '../../../domain/events'
import { DisputeJobsScheduler } from '../../../infrastructure/jobs/dispute-jobs.scheduler'
import { FileDisputeCommand } from './file-dispute.command'

@CommandHandler(FileDisputeCommand)
export class FileDisputeHandler implements ICommandHandler<FileDisputeCommand> {
    constructor(
        @Inject(DISPUTES_REPOSITORY_PORT) private readonly repo: DisputesRepositoryPort,
        @Inject(ORDERS_REPOSITORY_PORT) private readonly ordersRepo: OrdersRepositoryPort,
        private readonly jobs: DisputeJobsScheduler,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: FileDisputeCommand): Promise<void> {
        const result = await this.repo.fileDispute({
            orderId: command.orderId,
            viewerId: command.viewerId,
            reasonCode: command.reasonCode,
            statement: command.statement,
            evidenceFileIds: command.evidenceFileIds
        })
        await this.jobs.scheduleResponseTimeout(result.dispute.id, result.dispute.responseDeadline)
        const order = await this.ordersRepo.findByIdForViewer(result.orderId, command.viewerId)
        if (order) this.eventBus.publish(new DisputeFiledEvent(order, result.dispute))
    }
}
