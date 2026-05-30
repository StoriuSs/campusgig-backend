import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import { OrderListRow, OrderStatusCounts, OrdersRepositoryPort, ORDERS_REPOSITORY_PORT } from '../../../domain/ports'
import { ListOrdersQuery } from './list-orders.query'

@QueryHandler(ListOrdersQuery)
export class ListOrdersHandler implements IQueryHandler<ListOrdersQuery> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort
    ) {}

    execute(query: ListOrdersQuery): Promise<{ items: OrderListRow[]; total: number; counts: OrderStatusCounts }> {
        // The repo runs a single SQL pass that returns the page slice + the
        // per-status counts so the toolbar dropdown can show "All (15) ·
        // Pending (1) · ..." without a second round-trip.
        return this.repo.listForUser({
            viewerId: query.viewerId,
            side: query.side,
            statusFilter: query.statusFilter,
            actionRequiredOnly: query.actionRequiredOnly,
            query: query.query,
            sort: query.sort,
            page: query.page,
            pageSize: query.pageSize
        })
    }
}
