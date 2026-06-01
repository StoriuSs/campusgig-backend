import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import {
    AdminDisputeListResult,
    DISPUTES_REPOSITORY_PORT,
    DisputesRepositoryPort
} from '../../../domain/ports/disputes.repository.port'
import { ListAdminDisputesQuery } from './list-admin-disputes.query'

@QueryHandler(ListAdminDisputesQuery)
export class ListAdminDisputesHandler implements IQueryHandler<ListAdminDisputesQuery> {
    constructor(@Inject(DISPUTES_REPOSITORY_PORT) private readonly repo: DisputesRepositoryPort) {}

    execute(query: ListAdminDisputesQuery): Promise<AdminDisputeListResult> {
        return this.repo.listForAdmin(query.filters)
    }
}
