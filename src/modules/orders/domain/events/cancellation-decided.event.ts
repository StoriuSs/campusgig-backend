import type { CancellationItem, MoneyMoveRefs, OrderDetail } from '../ports/orders.repository.port'

export class CancellationDecidedEvent {
    constructor(
        public readonly order: OrderDetail,
        public readonly cancellation: CancellationItem,
        public readonly actorId: string,
        public readonly decision: 'accept' | 'reject',
        public readonly refs: MoneyMoveRefs
    ) {}
}
