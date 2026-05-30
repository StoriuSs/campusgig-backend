import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import { OrdersRepositoryPort, ORDERS_REPOSITORY_PORT } from '../../../domain/ports'
import { GetActionRequiredCountsQuery } from './get-action-required-counts.query'

@QueryHandler(GetActionRequiredCountsQuery)
export class GetActionRequiredCountsHandler implements IQueryHandler<GetActionRequiredCountsQuery> {
    constructor(
        @Inject(ORDERS_REPOSITORY_PORT)
        private readonly repo: OrdersRepositoryPort
    ) {}

    execute(query: GetActionRequiredCountsQuery): Promise<{ asBuyer: number; asSeller: number }> {
        return this.repo.countActionRequired(query.viewerId)
    }
}
