import { DashboardPeriod, SeriesBucket } from '../../application/period.util'

export const DASHBOARD_REPOSITORY_PORT = Symbol('DASHBOARD_REPOSITORY_PORT')

// Action-required item kinds. Each maps to a localized label + CTA on the client;
// the CTA deep-links to the order workspace where the mutation lives.
export type DashboardActionType =
    | 'new_order' // seller: PendingReview
    | 'cancellation_request' // either side: a pending cancellation the viewer must decide
    | 'dispute_response' // either side: frozen, viewer owes the 48h response
    | 'review_delivery' // buyer: Delivered
    | 'finalize' // buyer: AwaitingFinalization
    | 'extension_request' // buyer: a pending extension to decide
    | 'order_late' // buyer: order is Late

export interface DashboardActionItem {
    orderId: string
    code: string // CG-#### (formatted order number)
    type: DashboardActionType
    otherPartyName: string
    deadlineAt: string | null // ISO; for countdown context where relevant
}

// Shared order-preview row (matches the Order List row format).
export interface DashboardOrderRow {
    id: string
    code: string
    gigTitle: string
    gigCoverKey: string | null
    otherPartyName: string
    otherPartyAvatarKey: string | null
    status: string
    placedAt: string // ISO
    deadlineAt: string | null // ISO; delivery/review deadline relevant to the status
    amountVnd: number
}

// ── Seller ───────────────────────────────────────────────────────────────────
export interface SellerStatCards {
    earnings: { totalVnd: number; deltaPercent: number | null }
    escrow: { totalVnd: number; activeOrders: number }
    completionRate: { percent: number | null; completed: number; total: number }
    rating: { average: number; reviewCount: number } // average on a 0–5 scale
}

export interface GigEarningSlice {
    gigId: string | null // null = "Other" rollup
    title: string
    earningsVnd: number
}

export interface GigPerformanceRow {
    gigId: string
    title: string
    coverKey: string | null
    views: number
    orders: number
    conversionPercent: number // orders / views * 100 (0 when no views)
    earningsVnd: number
}

export interface SellerDashboardCacheable {
    statCards: SellerStatCards
    earningsSeries: { period: DashboardPeriod; totalVnd: number; buckets: SeriesBucket[] }
    earningsByGig: { totalVnd: number; slices: GigEarningSlice[] }
    activeOrders: DashboardOrderRow[]
    gigPerformance: GigPerformanceRow[]
    hasGigs: boolean
    hasOrders: boolean
}

// ── Buyer ────────────────────────────────────────────────────────────────────
export interface BuyerStatCards {
    ordersCompleted: number
    inEscrowVnd: number
    sellersWorkedWith: number
    totalSpentVnd: number
}

export interface RecommendedGig {
    gigId: string
    title: string
    coverKey: string | null
    sellerId: string
    sellerName: string
    sellerUsername: string | null
    sellerAvatarKey: string | null
    sellerIsEndorsed: boolean
    ratingAverage: number
    reviewCount: number
    priceVnd: number
    deliveryDays: number
}

export interface BuyerDashboardCacheable {
    statCards: BuyerStatCards
    recentOrders: DashboardOrderRow[]
    recommendations: RecommendedGig[]
    hasOrders: boolean
}

export interface DashboardRepositoryPort {
    getSellerCacheable(userId: string, period: DashboardPeriod): Promise<SellerDashboardCacheable>
    getSellerActionItems(userId: string): Promise<DashboardActionItem[]>
    getBuyerCacheable(userId: string): Promise<BuyerDashboardCacheable>
    getBuyerActionItems(userId: string): Promise<DashboardActionItem[]>
}
