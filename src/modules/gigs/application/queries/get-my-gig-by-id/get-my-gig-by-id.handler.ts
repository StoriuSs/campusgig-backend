import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { GetMyGigByIdQuery } from './get-my-gig-by-id.query'
import { GigRepositoryPort, GIG_REPOSITORY_PORT, GigWithRelations, GigNotFoundException } from '@/modules/gigs/domain'

@QueryHandler(GetMyGigByIdQuery)
export class GetMyGigByIdHandler implements IQueryHandler<GetMyGigByIdQuery> {
    constructor(@Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort) {}

    async execute(query: GetMyGigByIdQuery): Promise<GigWithRelations> {
        const bundle = await this.gigRepo.findByIdWithRelations(query.gigId)

        // 404-not-403 policy: don't leak that a gig exists if the caller doesn't own it.
        if (!bundle || bundle.gig.sellerId !== query.callerId || bundle.gig.isDeleted) {
            throw new GigNotFoundException(query.gigId)
        }

        return bundle
    }
}
