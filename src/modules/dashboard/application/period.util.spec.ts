import { bucketize, deltaPercent, parsePeriod, periodWindow } from './period.util'

describe('period.util', () => {
    const now = new Date('2026-06-15T12:00:00Z')

    describe('parsePeriod', () => {
        it('accepts valid periods and defaults invalid/empty to 30d', () => {
            expect(parsePeriod('7d')).toBe('7d')
            expect(parsePeriod('year')).toBe('year')
            expect(parsePeriod('all')).toBe('all')
            expect(parsePeriod('bogus')).toBe('30d')
            expect(parsePeriod(undefined)).toBe('30d')
        })
    })

    describe('periodWindow', () => {
        it('30d → daily, 30-day window, previous 30-day comparison window', () => {
            const w = periodWindow('30d', now)
            expect(w.granularity).toBe('day')
            expect(w.start).toEqual(new Date('2026-05-16T12:00:00Z'))
            expect(w.prevStart).toEqual(new Date('2026-04-16T12:00:00Z'))
            expect(w.prevEnd).toEqual(w.start)
        })

        it('year → year-to-date (Jan 1), monthly, YoY previous window', () => {
            const w = periodWindow('year', now)
            expect(w.granularity).toBe('month')
            expect(w.start).toEqual(new Date(2026, 0, 1))
            expect(w.prevStart).toEqual(new Date(2025, 0, 1))
        })

        it('all → no lower bound, monthly, no previous window', () => {
            const w = periodWindow('all', now)
            expect(w.start).toBeNull()
            expect(w.prevStart).toBeNull()
            expect(w.granularity).toBe('month')
        })
    })

    describe('bucketize', () => {
        it('sums in-window rows into daily buckets and excludes out-of-window rows', () => {
            const w = periodWindow('7d', now)
            const rows = [
                { createdAt: new Date('2026-06-15T09:00:00Z'), amountVnd: 100 },
                { createdAt: new Date('2026-06-15T10:30:00Z'), amountVnd: 50 }, // same day, before `now` → same bucket
                { createdAt: new Date('2026-06-10T09:00:00Z'), amountVnd: 200 },
                { createdAt: new Date('2026-01-01T09:00:00Z'), amountVnd: 999 } // out of window
            ]
            const { totalVnd, buckets } = bucketize(rows, w, now)
            expect(totalVnd).toBe(350)
            expect(buckets.length).toBeGreaterThanOrEqual(7)
            const last = buckets[buckets.length - 1]
            expect(last.valueVnd).toBe(150)
        })

        it('all-time buckets monthly from the first data point', () => {
            const w = periodWindow('all', now)
            const rows = [
                { createdAt: new Date('2026-04-10T00:00:00Z'), amountVnd: 10 },
                { createdAt: new Date('2026-06-01T00:00:00Z'), amountVnd: 20 }
            ]
            const { totalVnd, buckets } = bucketize(rows, w, now)
            expect(totalVnd).toBe(30)
            // Apr, May, Jun
            expect(buckets.length).toBe(3)
        })
    })

    describe('deltaPercent', () => {
        it('computes rounded percent and guards zero/no-previous', () => {
            expect(deltaPercent(118, 100, true)).toBe(18)
            expect(deltaPercent(80, 100, true)).toBe(-20)
            expect(deltaPercent(100, 0, true)).toBeNull()
            expect(deltaPercent(100, 50, false)).toBeNull()
        })
    })
})
