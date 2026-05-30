import type { OrderDetail } from '../ports/orders.repository.port'

export class OrderAutoCompletedEvent {
    constructor(public readonly order: OrderDetail) {}
}
