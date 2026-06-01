import { Inject } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import type { Cache } from 'cache-manager'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import {
    ADMIN_ACTIVITY_REPOSITORY_PORT,
    AdminActivityItem,
    AdminActivityRepositoryPort
} from '@/modules/admin-activity'

import {
    ADMIN_METRICS_REPOSITORY_PORT,
    ActionRequiredCounts,
    AdminMetricsRepositoryPort,
    DashboardCacheableMetrics
} from '../../../domain/ports/admin-metrics.repository.port'
import { GetDashboardQuery } from './get-dashboard.query'

const RECENT_ACTIVITY_LIMIT = 10
// Short TTL — heavy aggregates tolerate light staleness; live moderation
// counts are fetched outside the cache on every call (Q2).
const CACHEABLE_TTL_MS = 45_000

export interface DashboardResult extends DashboardCacheableMetrics {
    actionRequired: ActionRequiredCounts
    recentActivity: AdminActivityItem[]
}

@QueryHandler(GetDashboardQuery)
export class GetDashboardHandler implements IQueryHandler<GetDashboardQuery> {
    constructor(
        @Inject(ADMIN_METRICS_REPOSITORY_PORT) private readonly metricsRepo: AdminMetricsRepositoryPort,
        @Inject(ADMIN_ACTIVITY_REPOSITORY_PORT) private readonly activityRepo: AdminActivityRepositoryPort,
        @Inject(CACHE_MANAGER) private readonly cache: Cache
    ) {}

    async execute(query: GetDashboardQuery): Promise<DashboardResult> {
        const cacheKey = `admin:dashboard:cacheable:${query.period}`
        let cacheable = await this.cache.get<DashboardCacheableMetrics>(cacheKey)
        if (!cacheable) {
            cacheable = await this.metricsRepo.getCacheableMetrics(query.period)
            await this.cache.set(cacheKey, cacheable, CACHEABLE_TTL_MS)
        }

        const [actionRequired, recentActivity] = await Promise.all([
            this.metricsRepo.getActionRequiredCounts(),
            this.activityRepo.recent(RECENT_ACTIVITY_LIMIT)
        ])

        return { ...cacheable, actionRequired, recentActivity }
    }
}
