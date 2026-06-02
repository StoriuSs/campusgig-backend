// Period semantics for the seller dashboard (spec § Period semantics).
// `year` = year-to-date (Jan 1 → now), NOT a rolling 365 days. `all` has no
// lower bound and buckets monthly from the first data point.
export type DashboardPeriod = '7d' | '30d' | '3m' | '6m' | 'year' | 'all'

export const DASHBOARD_PERIODS: DashboardPeriod[] = ['7d', '30d', '3m', '6m', 'year', 'all']

export function parsePeriod(value: string | undefined): DashboardPeriod {
    return DASHBOARD_PERIODS.includes(value as DashboardPeriod) ? (value as DashboardPeriod) : '30d'
}

export type BucketGranularity = 'day' | 'week' | 'month'

export interface PeriodWindow {
    // Inclusive lower bound of the current window; null = all time.
    start: Date | null
    end: Date
    // Immediately-comparable previous window for the Δ stat; null when not applicable.
    prevStart: Date | null
    prevEnd: Date | null
    granularity: BucketGranularity
}

export interface SeriesBucket {
    label: string
    valueVnd: number
}

const DAY_MS = 86_400_000

function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function addDays(d: Date, n: number): Date {
    const out = new Date(d)
    out.setDate(out.getDate() + n)
    return out
}
function addMonths(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
}
// Monday-aligned week start.
function weekStart(d: Date): Date {
    const s = startOfDay(d)
    return addDays(s, -((s.getDay() + 6) % 7))
}
function monthStart(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1)
}
function ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function ym(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function periodWindow(period: DashboardPeriod, now: Date): PeriodWindow {
    switch (period) {
        case '7d':
            return {
                start: addDays(now, -7),
                end: now,
                prevStart: addDays(now, -14),
                prevEnd: addDays(now, -7),
                granularity: 'day'
            }
        case '30d':
            return {
                start: addDays(now, -30),
                end: now,
                prevStart: addDays(now, -60),
                prevEnd: addDays(now, -30),
                granularity: 'day'
            }
        case '3m':
            return {
                start: addMonths(now, -3),
                end: now,
                prevStart: addMonths(now, -6),
                prevEnd: addMonths(now, -3),
                granularity: 'week'
            }
        case '6m':
            return {
                start: addMonths(now, -6),
                end: now,
                prevStart: addMonths(now, -12),
                prevEnd: addMonths(now, -6),
                granularity: 'month'
            }
        case 'year': {
            const jan1 = new Date(now.getFullYear(), 0, 1)
            // YoY: compare against the same span last year.
            return {
                start: jan1,
                end: now,
                prevStart: new Date(now.getFullYear() - 1, 0, 1),
                prevEnd: addMonths(now, -12),
                granularity: 'month'
            }
        }
        case 'all':
        default:
            return { start: null, end: now, prevStart: null, prevEnd: null, granularity: 'month' }
    }
}

function bucketStart(d: Date, g: BucketGranularity): Date {
    return g === 'day' ? startOfDay(d) : g === 'week' ? weekStart(d) : monthStart(d)
}
function bucketLabel(d: Date, g: BucketGranularity): string {
    return g === 'month' ? ym(d) : ymd(d)
}
function stepForward(d: Date, g: BucketGranularity): Date {
    return g === 'day' ? addDays(d, 1) : g === 'week' ? addDays(d, 7) : addMonths(d, 1)
}

// Pre-build the empty bucket skeleton so gaps render as zero bars.
export function buildSkeleton(window: PeriodWindow, now: Date, firstDataDate: Date | null): SeriesBucket[] {
    const lower = window.start ?? firstDataDate ?? now
    let cursor = bucketStart(lower, window.granularity)
    const last = bucketStart(now, window.granularity)
    const out: SeriesBucket[] = []
    // Guard against pathological ranges.
    for (let i = 0; cursor <= last && i < 400; i++) {
        out.push({ label: bucketLabel(cursor, window.granularity), valueVnd: 0 })
        cursor = stepForward(cursor, window.granularity)
    }
    return out
}

// Sum `amountVnd` of rows that fall inside the window into the bucket skeleton.
export function bucketize(
    rows: { createdAt: Date; amountVnd: number }[],
    window: PeriodWindow,
    now: Date
): { totalVnd: number; buckets: SeriesBucket[] } {
    const inWindow = rows.filter((r) => (window.start === null || r.createdAt >= window.start) && r.createdAt <= now)
    const firstDataDate = inWindow.length > 0 ? inWindow[0].createdAt : null
    const buckets = buildSkeleton(window, now, firstDataDate)
    const index = new Map(buckets.map((b, i) => [b.label, i]))
    let totalVnd = 0
    for (const r of inWindow) {
        totalVnd += r.amountVnd
        const i = index.get(bucketLabel(bucketStart(r.createdAt, window.granularity), window.granularity))
        if (i !== undefined) buckets[i].valueVnd += r.amountVnd
    }
    return { totalVnd, buckets }
}

// Δ% of current vs previous window; null when there is no comparable previous window or it was zero.
export function deltaPercent(current: number, previous: number, hasPrev: boolean): number | null {
    if (!hasPrev || previous <= 0) return null
    return Math.round(((current - previous) / previous) * 100)
}

export { DAY_MS }
