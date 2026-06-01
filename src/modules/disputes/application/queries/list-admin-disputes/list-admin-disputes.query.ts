import { AdminDisputeFilters } from '../../../domain/ports/disputes.repository.port'

export class ListAdminDisputesQuery {
    constructor(public readonly filters: AdminDisputeFilters) {}
}
