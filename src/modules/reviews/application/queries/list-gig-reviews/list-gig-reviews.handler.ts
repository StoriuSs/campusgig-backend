import { Inject } from '@nestjs/common'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import {
    REVIEWS_REPOSITORY_PORT,
    ReviewItem,
    ReviewsRepositoryPort
} from '../../../domain/ports/reviews.repository.port'
import { ListGigReviewsQuery } from './list-gig-reviews.query'

const TTL_MS = 5 * 60 * 1000

@QueryHandler(ListGigReviewsQuery)
export class ListGigReviewsHandler implements IQueryHandler<ListGigReviewsQuery> {
    constructor(
        @Inject(REVIEWS_REPOSITORY_PORT)
        private readonly repo: ReviewsRepositoryPort,
        @Inject(CACHE_MANAGER) private readonly cache: Cache
    ) {}

    async execute(query: ListGigReviewsQuery): Promise<{ items: ReviewItem[]; total: number }> {
        const skip = (query.page - 1) * query.pageSize
        const fetch = () =>
            this.repo.listForGig({
                gigId: query.gigId,
                tier: query.tier,
                query: query.query,
                skip,
                take: query.pageSize
            })

        // Search has an unbounded keyspace — skip the cache for it.
        if (query.query) return fetch()

        // Version-namespaced key: the invalidation handler bumps the version
        // instead of deleting each (tier, page) key (the cache only supports
        // single-key del). Old-version keys go unread and TTL-expire.
        let ver = 0
        try {
            ver = (await this.cache.get<number>(`gig:reviews:ver:${query.gigId}`)) ?? 0
        } catch {
            /* version unavailable — treat as 0 */
        }
        const key = `gig:reviews:${query.gigId}:v${ver}:${query.tier}:${query.page}`
        try {
            const cached = await this.cache.get<{ items: ReviewItem[]; total: number }>(key)
            if (cached) return cached
        } catch {
            /* cache miss / unavailable — fall through to DB */
        }
        const result = await fetch()
        try {
            await this.cache.set(key, result, TTL_MS)
        } catch {
            /* non-fatal */
        }
        return result
    }
}
