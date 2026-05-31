import { EventsHandler, IEventHandler } from '@nestjs/cqrs'

import { SocketEmitter } from '@/modules/messaging/application/events/handlers/socket-emitter.service'

import type { OrderDetail } from '../../../domain/ports'
import {
    CancellationDecidedEvent,
    CancellationExpiredEvent,
    CancellationRequestedEvent,
    ExtensionDecidedEvent,
    ExtensionExpiredEvent,
    ExtensionRequestedEvent,
    OrderAcceptedDeliveryEvent,
    OrderAcceptedEvent,
    OrderAutoCancelledEvent,
    OrderAutoCompletedEvent,
    OrderDeclinedEvent,
    OrderDeliveredEvent,
    OrderDeliveryUpdatedEvent,
    OrderFinalizedEvent,
    OrderMarkedLateEvent,
    OrderPlacedEvent
} from '../../../domain/events'
import { toOrderWirePayload } from './order-wire-payload'

// Every order transition emits the same `order:updated` socket event with
// the full OrderDetail wire payload — the frontend's DVA model replaces its
// in-memory order object by id. A single string `event` keeps the wire small
// and means new states/transitions don't require frontend listener changes.
const WIRE_EVENT = 'order:updated'

function emit(emitter: SocketEmitter, order: OrderDetail): void {
    const payload = { order: toOrderWirePayload(order) }
    // Emit to BOTH parties' user rooms so the workspace AND the orders list
    // refresh in realtime regardless of which page either user has open.
    emitter.emitToUser(order.buyer.id, WIRE_EVENT, payload)
    emitter.emitToUser(order.seller.id, WIRE_EVENT, payload)
}

@EventsHandler(OrderPlacedEvent)
export class OrderPlacedSocketHandler implements IEventHandler<OrderPlacedEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: OrderPlacedEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(OrderAcceptedEvent)
export class OrderAcceptedSocketHandler implements IEventHandler<OrderAcceptedEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: OrderAcceptedEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(OrderDeclinedEvent)
export class OrderDeclinedSocketHandler implements IEventHandler<OrderDeclinedEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: OrderDeclinedEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(OrderAutoCancelledEvent)
export class OrderAutoCancelledSocketHandler implements IEventHandler<OrderAutoCancelledEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: OrderAutoCancelledEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(OrderMarkedLateEvent)
export class OrderMarkedLateSocketHandler implements IEventHandler<OrderMarkedLateEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: OrderMarkedLateEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(OrderDeliveredEvent)
export class OrderDeliveredSocketHandler implements IEventHandler<OrderDeliveredEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: OrderDeliveredEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(OrderDeliveryUpdatedEvent)
export class OrderDeliveryUpdatedSocketHandler implements IEventHandler<OrderDeliveryUpdatedEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: OrderDeliveryUpdatedEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(OrderAcceptedDeliveryEvent)
export class OrderAcceptedDeliverySocketHandler implements IEventHandler<OrderAcceptedDeliveryEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: OrderAcceptedDeliveryEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(OrderAutoCompletedEvent)
export class OrderAutoCompletedSocketHandler implements IEventHandler<OrderAutoCompletedEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: OrderAutoCompletedEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(OrderFinalizedEvent)
export class OrderFinalizedSocketHandler implements IEventHandler<OrderFinalizedEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: OrderFinalizedEvent): void {
        emit(this.emitter, event.order)
    }
}

// Extension / cancellation request + decide + expire events all carry the
// post-transition OrderDetail (with pendingExtension / pendingCancellation
// fields populated or cleared as appropriate), so the frontend's DVA model
// re-renders the right decision-card slot without a refetch.

@EventsHandler(ExtensionRequestedEvent)
export class ExtensionRequestedSocketHandler implements IEventHandler<ExtensionRequestedEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: ExtensionRequestedEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(ExtensionDecidedEvent)
export class ExtensionDecidedSocketHandler implements IEventHandler<ExtensionDecidedEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: ExtensionDecidedEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(ExtensionExpiredEvent)
export class ExtensionExpiredSocketHandler implements IEventHandler<ExtensionExpiredEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: ExtensionExpiredEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(CancellationRequestedEvent)
export class CancellationRequestedSocketHandler implements IEventHandler<CancellationRequestedEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: CancellationRequestedEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(CancellationDecidedEvent)
export class CancellationDecidedSocketHandler implements IEventHandler<CancellationDecidedEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: CancellationDecidedEvent): void {
        emit(this.emitter, event.order)
    }
}

@EventsHandler(CancellationExpiredEvent)
export class CancellationExpiredSocketHandler implements IEventHandler<CancellationExpiredEvent> {
    constructor(private readonly emitter: SocketEmitter) {}
    handle(event: CancellationExpiredEvent): void {
        emit(this.emitter, event.order)
    }
}
