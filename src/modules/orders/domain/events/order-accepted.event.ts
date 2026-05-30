import type { OrderDetail } from '../ports/orders.repository.port'

export class OrderAcceptedEvent {
    constructor(
        public readonly order: OrderDetail,
        public readonly actorId: string
    ) {}
}
