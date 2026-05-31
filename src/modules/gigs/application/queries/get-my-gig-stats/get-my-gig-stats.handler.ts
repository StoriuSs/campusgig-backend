import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { GetMyGigStatsQuery } from './get-my-gig-stats.query'
import {
    GigRepositoryPort,
    GIG_REPOSITORY_PORT,
    GigStats,
    GigNotFoundException,
    resolveGigStatsRange
} from '@/modules/gigs/domain'

@QueryHandler(GetMyGigStatsQuery)
export class GetMyGigStatsHandler implements IQueryHandler<GetMyGigStatsQuery> {
    constructor(@Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort) {}

    async execute(query: GetMyGigStatsQuery): Promise<GigStats> {
        const gig = await this.gigRepo.findById(query.gigId)
        if (!gig || gig.sellerId !== query.callerId || gig.isDeleted) {
            throw new GigNotFoundException(query.gigId)
        }

        const range = resolveGigStatsRange(query.period, new Date())
        return this.gigRepo.getStats(query.gigId, range)
    }
}
