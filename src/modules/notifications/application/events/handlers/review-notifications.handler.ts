import { EventsHandler, IEventHandler, CommandBus } from '@nestjs/cqrs'

import { ReviewSubmittedEvent } from '@/modules/reviews/domain/events'

import { CreateNotificationCommand } from '../../create-notification/create-notification.command'

@EventsHandler(ReviewSubmittedEvent)
export class ReviewNotificationsHandler implements IEventHandler<ReviewSubmittedEvent> {
    constructor(private readonly commandBus: CommandBus) {}

    handle(event: ReviewSubmittedEvent): Promise<void> {
        return this.commandBus.execute(
            new CreateNotificationCommand([event.sellerId], 'review_left', {
                orderId: event.orderId,
                ratingStars: event.ratingHalfStars / 2
            })
        )
    }
}
