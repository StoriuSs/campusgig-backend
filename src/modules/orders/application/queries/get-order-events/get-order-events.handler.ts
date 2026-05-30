import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import { OrderEventItem, OrdersRepositoryPort, ORDERS_REPOSITORY_PORT } from '../../../domain/ports'
import { GetOrderEventsQuery } from './get-order-events.query'

@QueryHandler(GetOrderEventsQuery)
export class GetOrderEventsHandler implements IQueryHandler<GetOrderEventsQuery> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort
    ) {}

    execute(query: GetOrderEventsQuery): Promise<OrderEventItem[]> {
        return this.repo.listEvents(query.orderId, query.viewerId)
    }
}
