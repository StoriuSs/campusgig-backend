import type { MoneyMoveRefs, OrderDetail } from '../ports/orders.repository.port'

export class OrderPlacedEvent {
    constructor(
        public readonly order: OrderDetail,
        public readonly refs: MoneyMoveRefs,
        public readonly actorId: string
    ) {}
}
