import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs'

import { formatOrderCode } from '@/shared/utils'
import {
    CancellationDecidedEvent,
    CancellationRequestedEvent,
    ExtensionDecidedEvent,
    ExtensionRequestedEvent,
    OrderAcceptedDeliveryEvent,
    OrderAcceptedEvent,
    OrderAutoCompletedEvent,
    OrderDeclinedEvent,
    OrderDeliveredEvent,
    OrderMarkedLateEvent,
    OrderPlacedEvent
} from '@/modules/orders/domain/events'
import type { OrderDetail, OrderParty } from '@/modules/orders/domain/ports'

import { NotificationData, NotificationType } from '../../../domain/notification.types'
import { CreateNotificationCommand } from '../../create-notification/create-notification.command'

const PLATFORM_FEE_PCT = 20

type OrderEvent =
    | OrderPlacedEvent
    | OrderAcceptedEvent
    | OrderDeclinedEvent
    | OrderDeliveredEvent
    | OrderAcceptedDeliveryEvent
    | OrderAutoCompletedEvent
    | OrderMarkedLateEvent
    | ExtensionRequestedEvent
    | ExtensionDecidedEvent
    | CancellationRequestedEvent
    | CancellationDecidedEvent

@EventsHandler(
    OrderPlacedEvent,
    OrderAcceptedEvent,
    OrderDeclinedEvent,
    OrderDeliveredEvent,
    OrderAcceptedDeliveryEvent,
    OrderAutoCompletedEvent,
    OrderMarkedLateEvent,
    ExtensionRequestedEvent,
    ExtensionDecidedEvent,
    CancellationRequestedEvent,
    CancellationDecidedEvent
)
export class OrderNotificationsHandler implements IEventHandler<OrderEvent> {
    constructor(private readonly commandBus: CommandBus) {}

    async handle(event: OrderEvent): Promise<void> {
        if (event instanceof OrderPlacedEvent) {
            const { recipient, actorName } = this.parties(event.order, event.actorId)
            await this.notify(recipient.id, 'order_placed', this.base(event.order, { actorName }))
        } else if (event instanceof OrderAcceptedEvent) {
            const { recipient, actorName } = this.parties(event.order, event.actorId)
            await this.notify(recipient.id, 'order_accepted', this.base(event.order, { actorName }))
        } else if (event instanceof OrderDeclinedEvent) {
            const { recipient, actorName } = this.parties(event.order, event.actorId)
            await this.notify(recipient.id, 'order_declined', this.base(event.order, { actorName }))
        } else if (event instanceof OrderDeliveredEvent) {
            const { recipient, actorName } = this.parties(event.order, event.actorId)
            await this.notify(recipient.id, 'order_delivered', this.base(event.order, { actorName }))
        } else if (event instanceof OrderAcceptedDeliveryEvent) {
            const { recipient, actorName } = this.parties(event.order, event.actorId)
            await this.notify(recipient.id, 'order_completed', this.base(event.order, { actorName }))
            const price = event.order.gig.priceVndSnapshot
            const earning = price - Math.floor((price * PLATFORM_FEE_PCT) / 100)
            await this.notify(recipient.id, 'funds_released', this.base(event.order, { amountVnd: earning }))
        } else if (event instanceof OrderAutoCompletedEvent) {
            await this.notify(event.order.buyer.id, 'order_auto_completed', this.base(event.order))
        } else if (event instanceof OrderMarkedLateEvent) {
            await this.notify(event.order.seller.id, 'order_marked_late', this.base(event.order))
        } else if (event instanceof ExtensionRequestedEvent) {
            const { recipient, actorName } = this.parties(event.order, event.actorId)
            await this.notify(recipient.id, 'extension_requested', this.base(event.order, { actorName }))
        } else if (event instanceof ExtensionDecidedEvent) {
            const { recipient, actorName } = this.parties(event.order, event.actorId)
            await this.notify(
                recipient.id,
                'extension_decided',
                this.base(event.order, { actorName, accepted: event.decision === 'accept' })
            )
        } else if (event instanceof CancellationRequestedEvent) {
            const { recipient, actorName } = this.parties(event.order, event.actorId)
            await this.notify(recipient.id, 'cancellation_requested', this.base(event.order, { actorName }))
        } else if (event instanceof CancellationDecidedEvent) {
            const { recipient, actorName } = this.parties(event.order, event.actorId)
            await this.notify(
                recipient.id,
                'cancellation_decided',
                this.base(event.order, { actorName, accepted: event.decision === 'accept' })
            )
        }
    }

    // Recipient = the party that did NOT trigger the action; actorName = the one who did.
    private parties(order: OrderDetail, actorId: string): { recipient: OrderParty; actorName: string } {
        const actorIsBuyer = actorId === order.buyer.id
        const actor = actorIsBuyer ? order.buyer : order.seller
        const recipient = actorIsBuyer ? order.seller : order.buyer
        return { recipient, actorName: actor.displayName ?? actor.username ?? 'Someone' }
    }

    private base(order: OrderDetail, extra: NotificationData = {}): NotificationData {
        return {
            orderId: order.id,
            orderCode: formatOrderCode(order.number),
            gigTitle: order.gig.titleSnapshot,
            ...extra
        }
    }

    private notify(recipientId: string, type: NotificationType, data: NotificationData): Promise<void> {
        return this.commandBus.execute(new CreateNotificationCommand([recipientId], type, data))
    }
}
