import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import {
    CancellationItem,
    MoneyMoveRefs,
    OrderDetail,
    ORDERS_REPOSITORY_PORT,
    OrdersRepositoryPort
} from '../../../domain/ports'
import { CancellationDecidedEvent } from '../../../domain/events'
import { DecideCancellationCommand } from './decide-cancellation.command'

@CommandHandler(DecideCancellationCommand)
export class DecideCancellationHandler implements ICommandHandler<DecideCancellationCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: DecideCancellationCommand): Promise<OrderDetail> {
        const result: {
            order: OrderDetail
            cancellation: CancellationItem
            refs: MoneyMoveRefs
        } = await this.repo.decideCancellation({
            cancellationId: command.cancellationId,
            viewerId: command.viewerId,
            decision: command.decision
        })

        this.eventBus.publish(
            new CancellationDecidedEvent(
                result.order,
                result.cancellation,
                command.viewerId,
                command.decision,
                result.refs
            )
        )
        return result.order
    }
}
