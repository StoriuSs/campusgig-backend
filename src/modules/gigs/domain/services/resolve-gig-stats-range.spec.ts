import { resolveGigStatsRange } from './resolve-gig-stats-range'

describe('resolveGigStatsRange', () => {
    // Mid-month so "thisMonth"/"lastMonth" boundaries are unambiguous.
    const now = new Date(2026, 4, 15, 10, 30, 0) // 2026-05-15 10:30 local

    it('thisMonth starts at the first of the current month with no upper bound', () => {
        const range = resolveGigStatsRange('thisMonth', now)
        expect(range.gte).toEqual(new Date(2026, 4, 1))
        expect(range.lt).toBeUndefined()
    })

    it('lastMonth is the full previous calendar month [gte, lt)', () => {
        const range = resolveGigStatsRange('lastMonth', now)
        expect(range.gte).toEqual(new Date(2026, 3, 1))
        expect(range.lt).toEqual(new Date(2026, 4, 1))
    })

    it('handles the January→December rollover for lastMonth', () => {
        const jan = new Date(2026, 0, 10)
        const range = resolveGigStatsRange('lastMonth', jan)
        expect(range.gte).toEqual(new Date(2025, 11, 1))
        expect(range.lt).toEqual(new Date(2026, 0, 1))
    })

    it.each([
        ['7d', 7],
        ['30d', 30],
        ['90d', 90]
    ] as const)('%s is an exact day-multiple back from now with no upper bound', (period, days) => {
        const range = resolveGigStatsRange(period, now)
        expect(range.gte).toEqual(new Date(now.getTime() - days * 24 * 60 * 60 * 1000))
        expect(range.lt).toBeUndefined()
    })

    it('all is unbounded', () => {
        expect(resolveGigStatsRange('all', now)).toEqual({})
    })
})
