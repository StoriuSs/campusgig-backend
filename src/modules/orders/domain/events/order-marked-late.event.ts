import type { OrderDetail } from '../ports/orders.repository.port'

export class OrderMarkedLateEvent {
    constructor(public readonly order: OrderDetail) {}
}
