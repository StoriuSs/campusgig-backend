import { Injectable } from '@nestjs/common'

import { PrismaService } from '@/shared/infrastructure'
import { formatOrderCode } from '@/shared/utils'

import {
    BuyerDashboardCacheable,
    DashboardActionItem,
    DashboardOrderRow,
    DashboardRepositoryPort,
    GigEarningSlice,
    GigPerformanceRow,
    RecommendedGig,
    SellerDashboardCacheable
} from '../../domain/ports/dashboard.repository.port'
import { DashboardPeriod, bucketize, deltaPercent, periodWindow } from '../../application/period.util'

const PLATFORM_FEE_PCT = 20
const ACTIVE_SELLER_STATUSES = ['InProgress', 'Late', 'Delivered', 'AwaitingFinalization'] as const
const ACTIVE_BUYER_STATUSES = ['InProgress', 'Late', 'Delivered', 'AwaitingFinalization'] as const
const TOP_GIGS_LIMIT = 5
const GIG_PERF_LIMIT = 3
const ACTION_ITEMS_LIMIT = 5
const RECOMMENDATIONS_LIMIT = 3

const payout = (priceVnd: number): number => priceVnd - Math.floor((priceVnd * PLATFORM_FEE_PCT) / 100)

interface EarnTx {
    createdAt: Date
    amountVnd: number
    orderId: string | null
}

@Injectable()
export class PrismaDashboardRepository implements DashboardRepositoryPort {
    constructor(private readonly prisma: PrismaService) {}

    // ── Seller ───────────────────────────────────────────────────────────────
    async getSellerCacheable(userId: string, period: DashboardPeriod): Promise<SellerDashboardCacheable> {
        const now = new Date()
        const window = periodWindow(period, now)

        const earnTx = (await this.prisma.transaction.findMany({
            where: { userId, type: 'Earning', status: 'Completed' },
            select: { createdAt: true, amountVnd: true, orderId: true },
            orderBy: { createdAt: 'asc' }
        })) as EarnTx[]

        // Stat: earnings (period) + Δ vs previous window.
        const inRange = (t: EarnTx, from: Date | null, to: Date | null) =>
            (from === null || t.createdAt >= from) && (to === null || t.createdAt < to)
        const currentEarnings = earnTx
            .filter((t) => (window.start === null || t.createdAt >= window.start) && t.createdAt <= now)
            .reduce((s, t) => s + t.amountVnd, 0)
        const prevEarnings = earnTx
            .filter((t) => window.prevStart !== null && inRange(t, window.prevStart, window.prevEnd))
            .reduce((s, t) => s + t.amountVnd, 0)

        const series = bucketize(earnTx, window, now)

        const [activeOrdersRaw, completedCount, cancelledCount, seller, sellerGigs, anyOrder] = await Promise.all([
            this.prisma.order.findMany({
                where: { sellerId: userId, status: { in: [...ACTIVE_SELLER_STATUSES] } },
                include: { buyer: { select: { displayName: true, username: true, avatarUrl: true } } },
                orderBy: { placedAt: 'desc' }
            }),
            this.prisma.order.count({
                where: {
                    sellerId: userId,
                    status: 'Completed',
                    ...(window.start ? { completedAt: { gte: window.start, lte: now } } : {})
                }
            }),
            this.prisma.order.count({
                where: {
                    sellerId: userId,
                    status: 'Cancelled',
                    ...(window.start ? { cancelledAt: { gte: window.start, lte: now } } : {})
                }
            }),
            this.prisma.user.findUnique({
                where: { id: userId },
                select: { reviewCount: true, ratingSumHalfStars: true }
            }),
            this.prisma.gig.findMany({
                where: { sellerId: userId, status: 'Active', deletedAt: null },
                select: {
                    id: true,
                    title: true,
                    images: { where: { position: 0 }, take: 1, select: { imageKey: true } }
                }
            }),
            this.prisma.order.findFirst({ where: { sellerId: userId }, select: { id: true } })
        ])

        const escrowTotal = activeOrdersRaw.reduce((s, o) => s + payout(o.gigPriceVndSnapshot), 0)
        const completionTotal = completedCount + cancelledCount
        const reviewCount = seller?.reviewCount ?? 0
        const ratingAverage = reviewCount > 0 ? (seller!.ratingSumHalfStars ?? 0) / 2 / reviewCount : 0

        const earningsByGig = await this.buildEarningsByGig(earnTx, window, now)
        const gigPerformance = await this.buildGigPerformance(sellerGigs, earnTx, window, now)

        return {
            statCards: {
                earnings: {
                    totalVnd: currentEarnings,
                    deltaPercent: deltaPercent(currentEarnings, prevEarnings, window.prevStart !== null)
                },
                escrow: { totalVnd: escrowTotal, activeOrders: activeOrdersRaw.length },
                completionRate: {
                    percent: completionTotal > 0 ? Math.round((completedCount / completionTotal) * 100) : null,
                    completed: completedCount,
                    total: completionTotal
                },
                rating: { average: Math.round(ratingAverage * 10) / 10, reviewCount }
            },
            earningsSeries: { period, totalVnd: series.totalVnd, buckets: series.buckets },
            earningsByGig,
            activeOrders: activeOrdersRaw.slice(0, 3).map((o) => this.toOrderRow(o, 'seller')),
            gigPerformance,
            hasGigs: sellerGigs.length > 0,
            hasOrders: anyOrder !== null
        }
    }

    private async buildEarningsByGig(
        earnTx: EarnTx[],
        window: ReturnType<typeof periodWindow>,
        now: Date
    ): Promise<{ totalVnd: number; slices: GigEarningSlice[] }> {
        const current = earnTx.filter(
            (t) => t.orderId && (window.start === null || t.createdAt >= window.start) && t.createdAt <= now
        )
        if (current.length === 0) return { totalVnd: 0, slices: [] }

        const orderIds = [...new Set(current.map((t) => t.orderId as string))]
        const orders = await this.prisma.order.findMany({
            where: { id: { in: orderIds } },
            select: { id: true, gigId: true, gigTitleSnapshot: true }
        })
        const byOrder = new Map(orders.map((o) => [o.id, o]))

        const sumByGig = new Map<string, { title: string; total: number }>()
        let totalVnd = 0
        for (const t of current) {
            const o = byOrder.get(t.orderId as string)
            if (!o) continue
            totalVnd += t.amountVnd
            const entry = sumByGig.get(o.gigId) ?? { title: o.gigTitleSnapshot, total: 0 }
            entry.total += t.amountVnd
            sumByGig.set(o.gigId, entry)
        }

        const ranked = [...sumByGig.entries()]
            .map(([gigId, v]) => ({ gigId, title: v.title, earningsVnd: v.total }))
            .sort((a, b) => b.earningsVnd - a.earningsVnd)
        const slices: GigEarningSlice[] = ranked.slice(0, TOP_GIGS_LIMIT)
        const rest = ranked.slice(TOP_GIGS_LIMIT)
        if (rest.length > 0) {
            slices.push({ gigId: null, title: 'Other', earningsVnd: rest.reduce((s, r) => s + r.earningsVnd, 0) })
        }
        return { totalVnd, slices }
    }

    private async buildGigPerformance(
        gigs: { id: string; title: string; images: { imageKey: string }[] }[],
        earnTx: EarnTx[],
        window: ReturnType<typeof periodWindow>,
        now: Date
    ): Promise<GigPerformanceRow[]> {
        if (gigs.length === 0) return []
        const gigIds = gigs.map((g) => g.id)
        const startFilter = window.start ? { gte: window.start, lte: now } : undefined

        const [viewGroups, orderGroups] = await Promise.all([
            this.prisma.gigView.groupBy({
                by: ['gigId'],
                where: { gigId: { in: gigIds }, ...(startFilter ? { createdAt: startFilter } : {}) },
                _count: { _all: true }
            }),
            this.prisma.order.groupBy({
                by: ['gigId'],
                where: { gigId: { in: gigIds }, ...(startFilter ? { placedAt: startFilter } : {}) },
                _count: { _all: true }
            })
        ])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const views = new Map(viewGroups.map((g: any) => [g.gigId as string, g._count._all as number]))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orders = new Map(orderGroups.map((g: any) => [g.gigId as string, g._count._all as number]))

        // Earnings per gig in window (reuse earnings-by-gig map keyed by gigId).
        const byGig = await this.buildEarningsByGig(earnTx, window, now)
        const earnByGig = new Map(byGig.slices.filter((s) => s.gigId).map((s) => [s.gigId as string, s.earningsVnd]))

        return gigs
            .map<GigPerformanceRow>((g) => {
                const v = views.get(g.id) ?? 0
                const o = orders.get(g.id) ?? 0
                return {
                    gigId: g.id,
                    title: g.title,
                    coverKey: g.images[0]?.imageKey ?? null,
                    views: v,
                    orders: o,
                    conversionPercent: v > 0 ? Math.round((o / v) * 1000) / 10 : 0,
                    earningsVnd: earnByGig.get(g.id) ?? 0
                }
            })
            .sort((a, b) => b.earningsVnd - a.earningsVnd)
            .slice(0, GIG_PERF_LIMIT)
    }

    async getSellerActionItems(userId: string): Promise<DashboardActionItem[]> {
        const rows = await this.prisma.order.findMany({
            where: { sellerId: userId, status: { in: ['PendingReview', 'InProgress', 'Late', 'Delivered', 'Frozen'] } },
            include: {
                buyer: { select: { displayName: true, username: true } },
                cancellations: { where: { status: 'Pending' }, take: 1 },
                dispute: { select: { filedByUserId: true, status: true } }
            },
            orderBy: { placedAt: 'desc' }
        })
        const items: DashboardActionItem[] = []
        for (const o of rows) {
            const name = o.buyer.displayName ?? o.buyer.username ?? 'A buyer'
            const base = { orderId: o.id, code: formatOrderCode(o.number), otherPartyName: name, deadlineAt: null }
            if (o.status === 'PendingReview')
                items.push({ ...base, type: 'new_order', deadlineAt: o.acceptDeadline?.toISOString() ?? null })
            else if (o.cancellations.length > 0 && o.cancellations[0].initiator === 'Buyer')
                items.push({ ...base, type: 'cancellation_request' })
            else if (
                o.status === 'Frozen' &&
                o.dispute?.status === 'AwaitingResponse' &&
                o.dispute.filedByUserId !== userId
            )
                items.push({ ...base, type: 'dispute_response' })
        }
        return items.slice(0, ACTION_ITEMS_LIMIT)
    }

    // ── Buyer ──────────────────────────────────────────────────────────────────
    async getBuyerCacheable(userId: string): Promise<BuyerDashboardCacheable> {
        // Total spent = Payment − Refund on the buyer's COMPLETED orders only. This nets out a
        // SplitFunds dispute's partial refund, and excludes cancelled-refunded orders entirely
        // and in-escrow active orders (the latter has its own stat).
        const completedIds = (
            await this.prisma.order.findMany({
                where: { buyerId: userId, status: 'Completed' },
                select: { id: true }
            })
        ).map((o) => o.id)

        const [escrowOrders, sellerGroups, paidAgg, refundAgg, recentRaw, anyOrder] = await Promise.all([
            this.prisma.order.findMany({
                where: { buyerId: userId, status: { in: [...ACTIVE_BUYER_STATUSES] } },
                select: { gigPriceVndSnapshot: true }
            }),
            this.prisma.order.groupBy({ by: ['sellerId'], where: { buyerId: userId, status: 'Completed' } }),
            this.prisma.transaction.aggregate({
                where: { userId, type: 'Payment', orderId: { in: completedIds } },
                _sum: { amountVnd: true }
            }),
            this.prisma.transaction.aggregate({
                where: { userId, type: 'Refund', orderId: { in: completedIds } },
                _sum: { amountVnd: true }
            }),
            this.prisma.order.findMany({
                where: { buyerId: userId },
                include: { seller: { select: { displayName: true, username: true, avatarUrl: true } } },
                orderBy: { placedAt: 'desc' },
                take: 2
            }),
            this.prisma.order.findFirst({ where: { buyerId: userId }, select: { id: true } })
        ])

        const recommendations = await this.buildRecommendations(userId)

        return {
            statCards: {
                ordersCompleted: completedIds.length,
                inEscrowVnd: escrowOrders.reduce((s, o) => s + o.gigPriceVndSnapshot, 0),
                sellersWorkedWith: sellerGroups.length,
                totalSpentVnd: (paidAgg._sum.amountVnd ?? 0) - (refundAgg._sum.amountVnd ?? 0)
            },
            recentOrders: recentRaw.map((o) => this.toOrderRow(o, 'buyer')),
            recommendations,
            hasOrders: anyOrder !== null
        }
    }

    private async buildRecommendations(userId: string): Promise<RecommendedGig[]> {
        // Categories the buyer has ordered in, most-frequent first.
        const ordered = await this.prisma.order.findMany({
            where: { buyerId: userId },
            select: { gigId: true, gig: { select: { categoryId: true } } }
        })
        const orderedGigIds = new Set(ordered.map((o) => o.gigId))
        const catCount = new Map<string, number>()
        for (const o of ordered) {
            const c = o.gig?.categoryId
            if (c) catCount.set(c, (catCount.get(c) ?? 0) + 1)
        }
        const topCategories = [...catCount.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([c]) => c)

        const baseWhere = {
            status: 'Active',
            deletedAt: null,
            sellerId: { not: userId },
            id: { notIn: [...orderedGigIds] }
        }
        const recOrder = [{ reviewCount: 'desc' as const }, { ratingSumHalfStars: 'desc' as const }]
        // Category-based first; fall back to popular (most reviews) to fill 3.
        // When the buyer has no category history, the primary query is already the
        // popular fallback (baseWhere ordered by reviews). Select is inlined so
        // Prisma infers the row type (an extracted select widens to `never`).
        const primaryWhere = topCategories.length > 0 ? { ...baseWhere, categoryId: { in: topCategories } } : baseWhere
        const primary = await this.prisma.gig.findMany({
            where: primaryWhere,
            select: {
                id: true,
                title: true,
                priceVnd: true,
                deliveryDays: true,
                reviewCount: true,
                ratingSumHalfStars: true,
                sellerId: true,
                images: { where: { position: 0 }, take: 1, select: { imageKey: true } }
            },
            orderBy: recOrder,
            take: RECOMMENDATIONS_LIMIT
        })
        const picked = [...primary]
        if (topCategories.length > 0 && picked.length < RECOMMENDATIONS_LIMIT) {
            const fillIds = picked.map((g) => g.id)
            const fallback = await this.prisma.gig.findMany({
                where: { ...baseWhere, id: { notIn: [...orderedGigIds, ...fillIds] } },
                select: {
                    id: true,
                    title: true,
                    priceVnd: true,
                    deliveryDays: true,
                    reviewCount: true,
                    ratingSumHalfStars: true,
                    sellerId: true,
                    images: { where: { position: 0 }, take: 1, select: { imageKey: true } }
                },
                orderBy: recOrder,
                take: RECOMMENDATIONS_LIMIT - picked.length
            })
            picked.push(...fallback)
        }

        // Gig has no `seller` relation (only sellerId) — resolve seller names/avatars separately.
        const sellerIds = [...new Set(picked.map((g) => g.sellerId))]
        const sellers = await this.prisma.user.findMany({
            where: { id: { in: sellerIds } },
            select: { id: true, displayName: true, username: true, avatarUrl: true, endorsedAt: true }
        })
        const sellerById = new Map(sellers.map((u) => [u.id, u]))

        return picked.map((g) => {
            const s = sellerById.get(g.sellerId)
            return {
                gigId: g.id,
                title: g.title,
                coverKey: g.images[0]?.imageKey ?? null,
                sellerId: g.sellerId,
                sellerName: s?.displayName ?? s?.username ?? 'Seller',
                sellerUsername: s?.username ?? null,
                sellerAvatarKey: s?.avatarUrl ?? null,
                sellerIsEndorsed: s?.endorsedAt != null,
                ratingAverage: g.reviewCount > 0 ? Math.round((g.ratingSumHalfStars / 2 / g.reviewCount) * 10) / 10 : 0,
                reviewCount: g.reviewCount,
                priceVnd: g.priceVnd,
                deliveryDays: g.deliveryDays
            }
        })
    }

    async getBuyerActionItems(userId: string): Promise<DashboardActionItem[]> {
        const rows = await this.prisma.order.findMany({
            where: {
                buyerId: userId,
                status: { in: ['Delivered', 'InProgress', 'Late', 'AwaitingFinalization', 'Frozen'] }
            },
            include: {
                seller: { select: { displayName: true, username: true } },
                extensions: { where: { status: 'Pending' }, take: 1 },
                cancellations: { where: { status: 'Pending' }, take: 1 },
                dispute: { select: { filedByUserId: true, status: true } }
            },
            orderBy: { placedAt: 'desc' }
        })
        const items: DashboardActionItem[] = []
        for (const o of rows) {
            const name = o.seller.displayName ?? o.seller.username ?? 'A seller'
            const base = {
                orderId: o.id,
                code: formatOrderCode(o.number),
                otherPartyName: name,
                deadlineAt: null as string | null
            }
            if (o.status === 'Delivered')
                items.push({ ...base, type: 'review_delivery', deadlineAt: o.reviewDeadline?.toISOString() ?? null })
            else if (o.status === 'AwaitingFinalization')
                items.push({ ...base, type: 'finalize', deadlineAt: o.reviewDeadline?.toISOString() ?? null })
            else if (o.extensions.length > 0) items.push({ ...base, type: 'extension_request' })
            else if (o.cancellations.length > 0 && o.cancellations[0].initiator === 'Seller')
                items.push({ ...base, type: 'cancellation_request' })
            else if (
                o.status === 'Frozen' &&
                o.dispute?.status === 'AwaitingResponse' &&
                o.dispute.filedByUserId !== userId
            )
                items.push({ ...base, type: 'dispute_response' })
            else if (o.status === 'Late')
                items.push({ ...base, type: 'order_late', deadlineAt: o.deliveryDeadline?.toISOString() ?? null })
        }
        return items.slice(0, ACTION_ITEMS_LIMIT)
    }

    // ── Shared ───────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toOrderRow(o: any, viewer: 'seller' | 'buyer'): DashboardOrderRow {
        const other = viewer === 'seller' ? o.buyer : o.seller
        let deadlineAt: Date | null = null
        if (o.status === 'PendingReview') deadlineAt = o.acceptDeadline
        else if (o.status === 'InProgress' || o.status === 'Late') deadlineAt = o.deliveryDeadline
        else if (o.status === 'Delivered' || o.status === 'AwaitingFinalization') deadlineAt = o.reviewDeadline
        return {
            id: o.id,
            code: formatOrderCode(o.number),
            gigTitle: o.gigTitleSnapshot,
            gigCoverKey: o.gigCoverKey ?? null,
            otherPartyName: other?.displayName ?? other?.username ?? '—',
            otherPartyAvatarKey: other?.avatarUrl ?? null,
            status: o.status,
            placedAt: o.placedAt.toISOString(),
            deadlineAt: deadlineAt ? deadlineAt.toISOString() : null,
            amountVnd: o.gigPriceVndSnapshot
        }
    }
}
