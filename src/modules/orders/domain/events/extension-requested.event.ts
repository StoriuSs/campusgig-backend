import type { ExtensionItem, OrderDetail } from '../ports/orders.repository.port'

export class ExtensionRequestedEvent {
    constructor(
        public readonly order: OrderDetail,
        public readonly extension: ExtensionItem,
        public readonly actorId: string
    ) {}
}
