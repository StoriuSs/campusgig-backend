import type { ExtensionItem, OrderDetail } from '../ports/orders.repository.port'

export class ExtensionDecidedEvent {
    constructor(
        public readonly order: OrderDetail,
        public readonly extension: ExtensionItem,
        public readonly actorId: string,
        public readonly decision: 'accept' | 'reject'
    ) {}
}
