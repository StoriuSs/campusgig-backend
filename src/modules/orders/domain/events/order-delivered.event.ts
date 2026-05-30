import type { DeliveryItem, OrderDetail } from '../ports/orders.repository.port'

export class OrderDeliveredEvent {
    constructor(
        public readonly order: OrderDetail,
        public readonly delivery: DeliveryItem,
        public readonly actorId: string
    ) {}
}
