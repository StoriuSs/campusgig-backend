import { Inject } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import type { Cache } from 'cache-manager'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import {
    DASHBOARD_REPOSITORY_PORT,
    BuyerDashboardCacheable,
    DashboardActionItem,
    DashboardRepositoryPort
} from '../../../domain/ports/dashboard.repository.port'
import { GetBuyerDashboardQuery } from './get-buyer-dashboard.query'

const CACHEABLE_TTL_MS = 40_000

export interface BuyerDashboardResult extends BuyerDashboardCacheable {
    actionItems: DashboardActionItem[]
}

@QueryHandler(GetBuyerDashboardQuery)
export class GetBuyerDashboardHandler implements IQueryHandler<GetBuyerDashboardQuery> {
    constructor(
        @Inject(DASHBOARD_REPOSITORY_PORT) private readonly repo: DashboardRepositoryPort,
        @Inject(CACHE_MANAGER) private readonly cache: Cache
    ) {}

    async execute(query: GetBuyerDashboardQuery): Promise<BuyerDashboardResult> {
        const cacheKey = `dashboard:buyer:${query.userId}`
        let cacheable = await this.cache.get<BuyerDashboardCacheable>(cacheKey)
        if (!cacheable) {
            cacheable = await this.repo.getBuyerCacheable(query.userId)
            await this.cache.set(cacheKey, cacheable, CACHEABLE_TTL_MS)
        }
        const actionItems = await this.repo.getBuyerActionItems(query.userId)
        return { ...cacheable, actionItems }
    }
}
