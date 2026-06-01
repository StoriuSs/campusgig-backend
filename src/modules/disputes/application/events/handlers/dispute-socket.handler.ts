import { EventsHandler, IEventHandler } from '@nestjs/cqrs'

import { SocketEmitter } from '@/modules/messaging/application/events/handlers'
import { toOrderWirePayload } from '@/modules/orders/application/events/handlers/order-wire-payload'
import type { OrderDetail } from '@/modules/orders/domain/ports'

import { DisputeFiledEvent, DisputeResolvedEvent, DisputeUpdatedEvent } from '../../../domain/events'

// Every dispute transition reuses the orders `order:updated` socket event with
// the full wire payload (now carrying `dispute`), emitted to both parties so
// the workspace AND the orders list flip in realtime regardless of open page.
const WIRE_EVENT = 'order:updated'

function emit(emitter: SocketEmitter, order: OrderDetail): void {
    const payload = { order: toOrderWirePayload(order) }
    emitter.emitToUser(order.buyer.id, WIRE_EVENT, payload)
    emitter.emitToUser(order.seller.id, WIRE_EVENT, payload)
}

@EventsHandler(DisputeFiledEvent)
export class DisputeFiledSocketHandler implements IEventHandler<DisputeFiledEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: DisputeFiledEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(DisputeResolvedEvent)
export class DisputeResolvedSocketHandler implements IEventHandler<DisputeResolvedEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: DisputeResolvedEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(DisputeUpdatedEvent)
export class DisputeUpdatedSocketHandler implements IEventHandler<DisputeUpdatedEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: DisputeUpdatedEvent): void {
        emit(this.emitter, event.order)
    }
}
