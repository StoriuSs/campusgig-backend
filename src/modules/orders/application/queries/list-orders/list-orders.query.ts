import type { OrderStatus, OrdersSort } from '../../../domain/ports'

export class ListOrdersQuery {
    constructor(
        public readonly viewerId: string,
        public readonly side: 'buyer' | 'seller',
        public readonly statusFilter: OrderStatus | 'all',
        public readonly actionRequiredOnly: boolean,
        public readonly query: string | null,
        public readonly sort: OrdersSort,
        public readonly page: number,
        public readonly pageSize: number
    ) {}
}
