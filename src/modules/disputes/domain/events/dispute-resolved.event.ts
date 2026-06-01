import type { MoneyMoveRefs, OrderDetail } from '@/modules/orders/domain/ports'
import type { DisputeRecord } from '../ports/disputes.repository.port'

// Published after an admin verdict moves the escrow + lands the terminal order
// status. `refs` are the wallet transaction ids the verdict produced.
export class DisputeResolvedEvent {
    constructor(
        public readonly order: OrderDetail,
        public readonly dispute: DisputeRecord,
        public readonly refs: MoneyMoveRefs
    ) {}
}
