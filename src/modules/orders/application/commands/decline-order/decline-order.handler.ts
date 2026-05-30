import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { MoneyMoveRefs, OrderDetail, OrdersRepositoryPort, ORDERS_REPOSITORY_PORT } from '../../../domain/ports'
import { DeclineNoteTooShortException } from '../../../domain/exceptions'
import { OrderDeclinedEvent } from '../../../domain/events'
import { DeclineOrderCommand } from './decline-order.command'

const DECLINE_NOTE_MIN_LENGTH = 20

@CommandHandler(DeclineOrderCommand)
export class DeclineOrderHandler implements ICommandHandler<DeclineOrderCommand> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: DeclineOrderCommand): Promise<OrderDetail> {
        const note = command.note?.trim() ?? ''
        if (note.length < DECLINE_NOTE_MIN_LENGTH) {
            throw new DeclineNoteTooShortException(DECLINE_NOTE_MIN_LENGTH)
        }

        // Repo handles: viewer == seller guard, status == PendingReview guard,
        // status flip to Cancelled, refundFromEscrow, cancellationReason +
        // cancelledBy fields, AcceptDeadlineJob removal, OrderEvent + system
        // message — all in one $transaction.
        const order = await this.repo.declineOrder(command.orderId, command.viewerId, note)

        // The refs come back from refundFromEscrow inside the repo — we
        // surface the refund Transaction id in the event so future Notification
        // handlers can deep-link to the wallet row.
        const refs: MoneyMoveRefs = {}
        this.eventBus.publish(new OrderDeclinedEvent(order, refs, command.viewerId, note))
        return order
    }
}
