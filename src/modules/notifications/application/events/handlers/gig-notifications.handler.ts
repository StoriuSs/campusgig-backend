import { Inject } from '@nestjs/common'
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs'

import { GigApprovedEvent } from '@/modules/gigs/application/events/gig-approved.event'
import { GigRejectedEvent } from '@/modules/gigs/application/events/gig-rejected.event'
import { GigSubmittedEvent } from '@/modules/gigs/application/events/gig-submitted.event'

import {
    NOTIFICATION_REPOSITORY_PORT,
    NotificationRepositoryPort
} from '../../../domain/ports/notification.repository.port'
import { CreateNotificationCommand } from '../../create-notification/create-notification.command'

type GigEvent = GigApprovedEvent | GigRejectedEvent | GigSubmittedEvent

@EventsHandler(GigApprovedEvent, GigRejectedEvent, GigSubmittedEvent)
export class GigNotificationsHandler implements IEventHandler<GigEvent> {
    constructor(
        private readonly commandBus: CommandBus,
        @Inject(NOTIFICATION_REPOSITORY_PORT) private readonly repo: NotificationRepositoryPort
    ) {}

    async handle(event: GigEvent): Promise<void> {
        if (event instanceof GigApprovedEvent) {
            await this.commandBus.execute(
                new CreateNotificationCommand([event.sellerId], 'gig_approved', {
                    gigId: event.gigId,
                    gigTitle: event.gigTitle
                })
            )
            return
        }

        if (event instanceof GigRejectedEvent) {
            await this.commandBus.execute(
                new CreateNotificationCommand([event.sellerId], 'gig_rejected', {
                    gigId: event.gigId,
                    gigTitle: event.gigTitle,
                    reason: event.rejectionReason
                })
            )
            return
        }

        // GigSubmittedEvent → every admin.
        const adminIds = await this.repo.findAdminIds()
        if (adminIds.length === 0) return
        const sellerName = (await this.repo.findDisplayName(event.sellerId)) ?? 'A seller'
        await this.commandBus.execute(
            new CreateNotificationCommand(adminIds, 'admin_gig_pending', {
                gigId: event.gigId,
                gigTitle: event.gigTitle,
                sellerName
            })
        )
    }
}
