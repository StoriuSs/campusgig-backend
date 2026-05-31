import { GigStatsPeriod, GigStatsRange } from '../ports/gig.repository.port'

const DAY_MS = 24 * 60 * 60 * 1000

// Period → half-open [gte, lt) window. `now` is injected for test determinism;
// month boundaries use the server's local calendar (single-region v1).
export function resolveGigStatsRange(period: GigStatsPeriod, now: Date): GigStatsRange {
    switch (period) {
        case 'thisMonth': {
            const gte = new Date(now.getFullYear(), now.getMonth(), 1)
            return { gte }
        }
        case 'lastMonth': {
            const gte = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const lt = new Date(now.getFullYear(), now.getMonth(), 1)
            return { gte, lt }
        }
        case '7d':
            return { gte: new Date(now.getTime() - 7 * DAY_MS) }
        case '30d':
            return { gte: new Date(now.getTime() - 30 * DAY_MS) }
        case '90d':
            return { gte: new Date(now.getTime() - 90 * DAY_MS) }
        case 'all':
        default:
            return {}
    }
}
