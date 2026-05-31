import type { CancellationItem, OrderDetail } from '../ports/orders.repository.port'

export class CancellationExpiredEvent {
    constructor(
        public readonly order: OrderDetail,
        public readonly cancellation: CancellationItem
    ) {}
}
