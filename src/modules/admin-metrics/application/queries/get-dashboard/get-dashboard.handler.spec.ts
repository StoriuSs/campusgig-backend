import { Test, TestingModule } from '@nestjs/testing'
import { CACHE_MANAGER } from '@nestjs/cache-manager'

import { ADMIN_ACTIVITY_REPOSITORY_PORT } from '@/modules/admin-activity'
import { ADMIN_METRICS_REPOSITORY_PORT } from '../../../domain/ports/admin-metrics.repository.port'
import { GetDashboardHandler } from './get-dashboard.handler'
import { GetDashboardQuery } from './get-dashboard.query'

const CACHEABLE = { statCards: {}, revenueSeries: {}, categoryDistribution: {}, topSellers: [] }

describe('GetDashboardHandler', () => {
    let handler: GetDashboardHandler
    let metricsRepo: { getCacheableMetrics: jest.Mock; getActionRequiredCounts: jest.Mock }
    let activityRepo: { recent: jest.Mock }
    let cache: { get: jest.Mock; set: jest.Mock }

    beforeEach(async () => {
        metricsRepo = {
            getCacheableMetrics: jest.fn().mockResolvedValue(CACHEABLE),
            getActionRequiredCounts: jest
                .fn()
                .mockResolvedValue({ pendingGigs: 2, openDisputes: 1, pendingWithdrawals: 0 })
        }
        activityRepo = { recent: jest.fn().mockResolvedValue([{ id: 'a1' }]) }
        cache = { get: jest.fn(), set: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetDashboardHandler,
                { provide: ADMIN_METRICS_REPOSITORY_PORT, useValue: metricsRepo },
                { provide: ADMIN_ACTIVITY_REPOSITORY_PORT, useValue: activityRepo },
                { provide: CACHE_MANAGER, useValue: cache }
            ]
        }).compile()

        handler = module.get(GetDashboardHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('computes aggregates on a cache miss and writes them to the cache', async () => {
        cache.get.mockResolvedValue(undefined)

        const result = await handler.execute(new GetDashboardQuery('30d'))

        expect(metricsRepo.getCacheableMetrics).toHaveBeenCalledWith('30d')
        expect(cache.set).toHaveBeenCalledWith('admin:dashboard:cacheable:30d', CACHEABLE, expect.any(Number))
        // Live counts + recent activity always fetched outside the cache.
        expect(metricsRepo.getActionRequiredCounts).toHaveBeenCalled()
        expect(activityRepo.recent).toHaveBeenCalledWith(10)
        expect(result.actionRequired.pendingGigs).toBe(2)
        expect(result.recentActivity).toHaveLength(1)
    })

    it('serves cached aggregates without recomputing, but still fetches live counts', async () => {
        cache.get.mockResolvedValue(CACHEABLE)

        await handler.execute(new GetDashboardQuery('30d'))

        expect(metricsRepo.getCacheableMetrics).not.toHaveBeenCalled()
        expect(cache.set).not.toHaveBeenCalled()
        expect(metricsRepo.getActionRequiredCounts).toHaveBeenCalled()
        expect(activityRepo.recent).toHaveBeenCalled()
    })
})
