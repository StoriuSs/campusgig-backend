import type { OrderDetail } from '@/modules/orders/domain/ports'
import type { DisputeRecord } from '../ports/disputes.repository.port'

// Published after a dispute is filed + the order is frozen. Carries the
// post-transition OrderDetail so the socket handler can broadcast order:updated.
export class DisputeFiledEvent {
    constructor(
        public readonly order: OrderDetail,
        public readonly dispute: DisputeRecord
    ) {}
}
