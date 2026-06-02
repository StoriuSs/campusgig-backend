import { Inject } from '@nestjs/common'
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs'

import { formatOrderCode } from '@/shared/utils'
import { DisputeFiledEvent, DisputeResolvedEvent } from '@/modules/disputes/domain/events'

import {
    NOTIFICATION_REPOSITORY_PORT,
    NotificationRepositoryPort
} from '../../../domain/ports/notification.repository.port'
import { CreateNotificationCommand } from '../../create-notification/create-notification.command'

@EventsHandler(DisputeFiledEvent, DisputeResolvedEvent)
export class DisputeNotificationsHandler implements IEventHandler<DisputeFiledEvent | DisputeResolvedEvent> {
    constructor(
        private readonly commandBus: CommandBus,
        @Inject(NOTIFICATION_REPOSITORY_PORT) private readonly repo: NotificationRepositoryPort
    ) {}

    async handle(event: DisputeFiledEvent | DisputeResolvedEvent): Promise<void> {
        const { order } = event
        const data = { orderId: order.id, orderCode: formatOrderCode(order.number) }

        if (event instanceof DisputeFiledEvent) {
            // The non-filer party + every admin.
            const otherParty = order.buyer.id === event.dispute.filedByUserId ? order.seller : order.buyer
            await this.commandBus.execute(new CreateNotificationCommand([otherParty.id], 'dispute_filed', data))

            const adminIds = await this.repo.findAdminIds()
            if (adminIds.length > 0) {
                await this.commandBus.execute(new CreateNotificationCommand(adminIds, 'admin_dispute_filed', data))
            }
            return
        }

        // Resolved → both parties.
        await this.commandBus.execute(
            new CreateNotificationCommand([order.buyer.id, order.seller.id], 'dispute_resolved', {
                ...data,
                verdict: event.dispute.verdict ?? ''
            })
        )
    }
}
