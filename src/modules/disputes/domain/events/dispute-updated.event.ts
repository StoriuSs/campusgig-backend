import type { OrderDetail } from '@/modules/orders/domain/ports'

// Published on response / add-evidence / response-timeout — transitions that
// change the dispute but aren't a "filed"/"resolved" notification milestone.
// Drives the order:updated socket push so both workspaces re-render live.
export class DisputeUpdatedEvent {
    constructor(public readonly order: OrderDetail) {}
}
