export const ADMIN_METRICS_REPOSITORY_PORT = 'ADMIN_METRICS_REPOSITORY_PORT'

export type RevenuePeriod = '7d' | '30d' | '90d' | '1y' | 'all'

export interface RevenueBucket {
    label: string // 'YYYY-MM-DD' (daily/weekly bucket start) or 'YYYY-MM' (monthly)
    valueVnd: number
}

export interface DashboardStatCards {
    revenue: { totalVnd: number; momPercent: number | null }
    transactions: { total: number; thisMonth: number }
    activeUsers: { total: number; sellers: number; buyers: number }
    activeGigs: { total: number; pendingReview: number }
}

export interface CategorySlice {
    categoryId: string | null // null = the synthetic "Other" bucket
    name: string
    count: number
}

export interface TopSellerRow {
    id: string
    displayName: string | null
    username: string | null
    avatarKey: string | null
    earningsVnd: number
}

export interface DashboardCacheableMetrics {
    statCards: DashboardStatCards
    revenueSeries: { period: RevenuePeriod; totalVnd: number; buckets: RevenueBucket[] }
    categoryDistribution: { totalGigs: number; slices: CategorySlice[] }
    topSellers: TopSellerRow[]
}

export interface ActionRequiredCounts {
    pendingGigs: number
    openDisputes: number
    pendingWithdrawals: number
}

export interface AdminMetricsRepositoryPort {
    // Heavy aggregates — safe to serve from a short-TTL cache.
    getCacheableMetrics(period: RevenuePeriod): Promise<DashboardCacheableMetrics>
    // Live moderation backlog — must never be cached staler than the action.
    getActionRequiredCounts(): Promise<ActionRequiredCounts>
}
