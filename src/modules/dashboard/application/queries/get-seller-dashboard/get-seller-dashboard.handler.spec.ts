import { GetSellerDashboardHandler } from './get-seller-dashboard.handler'
import { GetSellerDashboardQuery } from './get-seller-dashboard.query'

describe('GetSellerDashboardHandler', () => {
    const cacheable = {
        statCards: {},
        earningsSeries: {},
        earningsByGig: {},
        activeOrders: [],
        gigPerformance: [],
        hasGigs: true,
        hasOrders: true
    }
    const actionItems = [
        { orderId: 'o1', code: 'CG-0001', type: 'new_order', otherPartyName: 'Buyer', deadlineAt: null }
    ]

    function make() {
        const repo = {
            getSellerCacheable: jest.fn().mockResolvedValue(cacheable),
            getSellerActionItems: jest.fn().mockResolvedValue(actionItems),
            getBuyerCacheable: jest.fn(),
            getBuyerActionItems: jest.fn()
        }
        const store = new Map<string, unknown>()
        const cache = {
            get: jest.fn((k: string) => Promise.resolve(store.get(k))),
            set: jest.fn((k: string, v: unknown) => {
                store.set(k, v)
                return Promise.resolve()
            })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handler = new GetSellerDashboardHandler(repo as any, cache as any)
        return { handler, repo, cache }
    }

    it('computes the cacheable block on a cache miss, then merges live action items', async () => {
        const { handler, repo, cache } = make()
        const res = await handler.execute(new GetSellerDashboardQuery('u1', '30d'))
        expect(repo.getSellerCacheable).toHaveBeenCalledWith('u1', '30d')
        expect(cache.set).toHaveBeenCalledWith('dashboard:seller:u1:30d', cacheable, expect.any(Number))
        expect(res.actionItems).toEqual(actionItems)
        expect(res.hasGigs).toBe(true)
    })

    it('serves the cacheable block from cache on a hit but still fetches action items live', async () => {
        const { handler, repo } = make()
        await handler.execute(new GetSellerDashboardQuery('u1', '30d'))
        await handler.execute(new GetSellerDashboardQuery('u1', '30d'))
        expect(repo.getSellerCacheable).toHaveBeenCalledTimes(1)
        expect(repo.getSellerActionItems).toHaveBeenCalledTimes(2)
    })
})
