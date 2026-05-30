import type { CancellationItem, OrderDetail } from '../ports/orders.repository.port'

export class CancellationRequestedEvent {
    constructor(
        public readonly order: OrderDetail,
        public readonly cancellation: CancellationItem,
        public readonly actorId: string
    ) {}
}
