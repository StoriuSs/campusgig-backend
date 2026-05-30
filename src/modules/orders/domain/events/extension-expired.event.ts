import type { ExtensionItem } from '../ports/orders.repository.port'

export class ExtensionExpiredEvent {
    constructor(public readonly extension: ExtensionItem) {}
}
