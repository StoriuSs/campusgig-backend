import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { GetAdminGigByIdQuery } from './get-admin-gig-by-id.query'
import { GigRepositoryPort, GIG_REPOSITORY_PORT, AdminGigDetail, GigNotFoundException } from '@/modules/gigs/domain'

@QueryHandler(GetAdminGigByIdQuery)
export class GetAdminGigByIdHandler implements IQueryHandler<GetAdminGigByIdQuery> {
    constructor(@Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort) {}

    async execute(query: GetAdminGigByIdQuery): Promise<AdminGigDetail> {
        const detail = await this.gigRepo.findByIdForAdmin(query.gigId)
        if (!detail || detail.gig.isDeleted) {
            throw new GigNotFoundException(query.gigId)
        }
        return detail
    }
}
