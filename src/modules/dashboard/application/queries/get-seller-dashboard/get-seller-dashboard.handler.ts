import { Inject } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import type { Cache } from 'cache-manager'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import {
    DASHBOARD_REPOSITORY_PORT,
    DashboardActionItem,
    DashboardRepositoryPort,
    SellerDashboardCacheable
} from '../../../domain/ports/dashboard.repository.port'
import { GetSellerDashboardQuery } from './get-seller-dashboard.query'

// Heavy aggregates tolerate light staleness; action items are fetched live.
const CACHEABLE_TTL_MS = 40_000

export interface SellerDashboardResult extends SellerDashboardCacheable {
    actionItems: DashboardActionItem[]
}

@QueryHandler(GetSellerDashboardQuery)
export class GetSellerDashboardHandler implements IQueryHandler<GetSellerDashboardQuery> {
    constructor(
        @Inject(DASHBOARD_REPOSITORY_PORT) private readonly repo: DashboardRepositoryPort,
        @Inject(CACHE_MANAGER) private readonly cache: Cache
    ) {}

    async execute(query: GetSellerDashboardQuery): Promise<SellerDashboardResult> {
        const cacheKey = `dashboard:seller:${query.userId}:${query.period}`
        let cacheable = await this.cache.get<SellerDashboardCacheable>(cacheKey)
        if (!cacheable) {
            cacheable = await this.repo.getSellerCacheable(query.userId, query.period)
            await this.cache.set(cacheKey, cacheable, CACHEABLE_TTL_MS)
        }
        const actionItems = await this.repo.getSellerActionItems(query.userId)
        return { ...cacheable, actionItems }
    }
}
