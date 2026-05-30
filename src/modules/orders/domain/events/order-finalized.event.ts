import type { MoneyMoveRefs, OrderDetail } from '../ports/orders.repository.port'

export class OrderFinalizedEvent {
    constructor(
        public readonly order: OrderDetail,
        public readonly refs: MoneyMoveRefs
    ) {}
}
