import { Injectable } from '@nestjs/common'

import { PrismaService } from '@/shared/infrastructure'
import { PLATFORM_FEE_COLLECTOR_USER_ID } from '@/shared/constants/platform'

import {
    ActionRequiredCounts,
    AdminMetricsRepositoryPort,
    CategorySlice,
    DashboardCacheableMetrics,
    RevenueBucket,
    RevenuePeriod,
    TopSellerRow
} from '../../domain/ports/admin-metrics.repository.port'

interface FeeTx {
    createdAt: Date
    amountVnd: number
}

const TOP_SELLERS_LIMIT = 5
const TOP_CATEGORIES_LIMIT = 5

@Injectable()
export class PrismaAdminMetricsRepository implements AdminMetricsRepositoryPort {
    constructor(private readonly prisma: PrismaService) {}

    async getCacheableMetrics(period: RevenuePeriod): Promise<DashboardCacheableMetrics> {
        // Platform revenue is booked as `Earning` transactions on the synthetic
        // platform-fee-collector user — one per revenue-generating order. Pull
        // them once; both the revenue stat and the chart series derive from this.
        const feeRows = (await this.prisma.transaction.findMany({
            where: { userId: PLATFORM_FEE_COLLECTOR_USER_ID, type: 'Earning', status: 'Completed' },
            select: { createdAt: true, amountVnd: true },
            orderBy: { createdAt: 'asc' }
        })) as FeeTx[]

        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

        let totalVnd = 0
        let thisMonthVnd = 0
        let lastMonthVnd = 0
        let thisMonthCount = 0
        for (const tx of feeRows) {
            totalVnd += tx.amountVnd
            if (tx.createdAt >= monthStart) {
                thisMonthVnd += tx.amountVnd
                thisMonthCount += 1
            } else if (tx.createdAt >= lastMonthStart) {
                lastMonthVnd += tx.amountVnd
            }
        }
        const momPercent = lastMonthVnd > 0 ? Math.round(((thisMonthVnd - lastMonthVnd) / lastMonthVnd) * 100) : null

        const [sellerGroups, buyerGroups, totalUsers, activeGigs, pendingGigs] = await Promise.all([
            this.prisma.gig.groupBy({ by: ['sellerId'], where: { deletedAt: null } }),
            this.prisma.order.groupBy({ by: ['buyerId'] }),
            this.prisma.user.count({ where: { isAdmin: false, deletedAt: null } }),
            this.prisma.gig.count({ where: { status: 'Active', deletedAt: null } }),
            this.prisma.gig.count({ where: { status: 'Pending', deletedAt: null } })
        ])

        const [categoryDistribution, topSellers] = await Promise.all([
            this.buildCategoryDistribution(),
            this.buildTopSellers(monthStart)
        ])

        return {
            statCards: {
                revenue: { totalVnd, momPercent },
                transactions: { total: feeRows.length, thisMonth: thisMonthCount },
                activeUsers: { total: totalUsers, sellers: sellerGroups.length, buyers: buyerGroups.length },
                activeGigs: { total: activeGigs, pendingReview: pendingGigs }
            },
            revenueSeries: this.buildRevenueSeries(period, feeRows, now),
            categoryDistribution,
            topSellers
        }
    }

    async getActionRequiredCounts(): Promise<ActionRequiredCounts> {
        const [pendingGigs, openDisputes, pendingWithdrawals] = await Promise.all([
            this.prisma.gig.count({ where: { status: 'Pending', deletedAt: null } }),
            this.prisma.dispute.count({ where: { status: { in: ['AwaitingResponse', 'ReadyForReview'] } } }),
            this.prisma.withdrawalRequest.count({ where: { status: 'Pending' } })
        ])
        return { pendingGigs, openDisputes, pendingWithdrawals }
    }

    // ── Builders ───────────────────────────────────────────────────────────

    private async buildCategoryDistribution(): Promise<DashboardCacheableMetrics['categoryDistribution']> {
        const groups = await this.prisma.gig.groupBy({
            by: ['categoryId'],
            where: { status: 'Active', deletedAt: null },
            _count: { _all: true }
        })
        const totalGigs = groups.reduce((sum: number, g: { _count: { _all: number } }) => sum + g._count._all, 0)
        if (groups.length === 0) return { totalGigs: 0, slices: [] }

        const categories = await this.prisma.category.findMany({ select: { id: true, name: true } })
        const nameById = new Map(categories.map((c) => [c.id, c.name]))

        const ranked = groups
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((g: any) => ({
                categoryId: g.categoryId as string,
                name: nameById.get(g.categoryId) ?? 'Unknown',
                count: g._count._all as number
            }))
            .sort((a, b) => b.count - a.count)

        const slices: CategorySlice[] = ranked.slice(0, TOP_CATEGORIES_LIMIT)
        const rest = ranked.slice(TOP_CATEGORIES_LIMIT)
        if (rest.length > 0) {
            slices.push({
                categoryId: null,
                name: 'Other',
                count: rest.reduce((sum, r) => sum + r.count, 0)
            })
        }
        return { totalGigs, slices }
    }

    private async buildTopSellers(monthStart: Date): Promise<TopSellerRow[]> {
        const groups = await this.prisma.transaction.groupBy({
            by: ['userId'],
            where: {
                type: 'Earning',
                status: 'Completed',
                userId: { not: PLATFORM_FEE_COLLECTOR_USER_ID },
                createdAt: { gte: monthStart }
            },
            _sum: { amountVnd: true },
            orderBy: { _sum: { amountVnd: 'desc' } },
            take: TOP_SELLERS_LIMIT
        })
        if (groups.length === 0) return []

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ids = groups.map((g: any) => g.userId as string)
        const users = await this.prisma.user.findMany({
            where: { id: { in: ids } },
            select: { id: true, displayName: true, username: true, avatarUrl: true }
        })
        const byId = new Map(users.map((u) => [u.id, u]))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return groups.map((g: any) => {
            const u = byId.get(g.userId)
            return {
                id: g.userId,
                displayName: u?.displayName ?? null,
                username: u?.username ?? null,
                avatarKey: u?.avatarUrl ?? null,
                earningsVnd: g._sum.amountVnd ?? 0
            }
        })
    }

    private buildRevenueSeries(
        period: RevenuePeriod,
        feeRows: FeeTx[],
        now: Date
    ): DashboardCacheableMetrics['revenueSeries'] {
        const buckets = this.skeleton(period, feeRows, now)
        const index = new Map(buckets.map((b, i) => [b.label, i]))
        const keyOf = this.bucketKeyFn(period)

        for (const tx of feeRows) {
            const i = index.get(keyOf(tx.createdAt))
            if (i !== undefined) buckets[i].valueVnd += tx.amountVnd
        }
        const totalVnd = buckets.reduce((sum, b) => sum + b.valueVnd, 0)
        return { period, totalVnd, buckets }
    }

    private skeleton(period: RevenuePeriod, feeRows: FeeTx[], now: Date): RevenueBucket[] {
        const out: RevenueBucket[] = []
        if (period === '7d' || period === '30d') {
            const days = period === '7d' ? 7 : 30
            const base = this.startOfDay(now)
            for (let i = days - 1; i >= 0; i--) {
                out.push({ label: this.ymd(this.addDays(base, -i)), valueVnd: 0 })
            }
        } else if (period === '90d') {
            const base = this.weekStart(now)
            for (let i = 12; i >= 0; i--) {
                out.push({ label: this.ymd(this.addDays(base, -i * 7)), valueVnd: 0 })
            }
        } else if (period === '1y') {
            for (let i = 11; i >= 0; i--) {
                out.push({ label: this.ym(new Date(now.getFullYear(), now.getMonth() - i, 1)), valueVnd: 0 })
            }
        } else {
            // all-time: monthly from the first transaction to the current month
            const first = feeRows[0]?.createdAt ?? now
            let cursor = new Date(first.getFullYear(), first.getMonth(), 1)
            const end = new Date(now.getFullYear(), now.getMonth(), 1)
            while (cursor <= end) {
                out.push({ label: this.ym(cursor), valueVnd: 0 })
                cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
            }
        }
        return out
    }

    private bucketKeyFn(period: RevenuePeriod): (d: Date) => string {
        if (period === '7d' || period === '30d') return (d) => this.ymd(this.startOfDay(d))
        if (period === '90d') return (d) => this.ymd(this.weekStart(d))
        return (d) => this.ym(d)
    }

    private startOfDay(d: Date): Date {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate())
    }

    private addDays(d: Date, n: number): Date {
        const out = new Date(d)
        out.setDate(out.getDate() + n)
        return out
    }

    // Monday-aligned week start.
    private weekStart(d: Date): Date {
        const s = this.startOfDay(d)
        const offset = (s.getDay() + 6) % 7
        return this.addDays(s, -offset)
    }

    private ymd(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    private ym(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }
}
