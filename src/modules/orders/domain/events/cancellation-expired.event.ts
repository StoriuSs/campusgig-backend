import type { CancellationItem } from '../ports/orders.repository.port'

export class CancellationExpiredEvent {
    constructor(public readonly cancellation: CancellationItem) {}
}
