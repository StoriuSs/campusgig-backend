import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import { OrderDetail, OrdersRepositoryPort, ORDERS_REPOSITORY_PORT } from '../../../domain/ports'
import { OrderNotFoundException } from '../../../domain/exceptions'
import { GetOrderQuery } from './get-order.query'

@QueryHandler(GetOrderQuery)
export class GetOrderHandler implements IQueryHandler<GetOrderQuery> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort
    ) {}

    async execute(query: GetOrderQuery): Promise<OrderDetail> {
        // 404-not-403: collapses "not found" and "not a participant" so existence isn't leaked.
        const order = await this.repo.findByIdForViewer(query.orderId, query.viewerId)
        if (!order) throw new OrderNotFoundException(query.orderId)
        return order
    }
}
