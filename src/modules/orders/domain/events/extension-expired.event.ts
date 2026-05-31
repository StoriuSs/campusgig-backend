import type { ExtensionItem, OrderDetail } from '../ports/orders.repository.port'

export class ExtensionExpiredEvent {
    constructor(
        public readonly order: OrderDetail,
        public readonly extension: ExtensionItem
    ) {}
}
