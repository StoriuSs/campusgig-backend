import { formatOrderCode } from '@/shared/utils'

import { DateRange, ReportPeriod, ReportTable } from '../domain/report.types'
import { ReportOrderRow, SellerAggregateRow } from '../domain/ports/report.repository.port'

const PLATFORM_FEE_PCT = 20

// ── Period → date range ──────────────────────────────────────────────────────

function subtractMonths(d: Date, n: number): Date {
    return new Date(d.getFullYear(), d.getMonth() - n, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())
}

function endOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}

export function resolvePeriodRange(period: ReportPeriod, from?: string, to?: string): DateRange {
    const now = new Date()
    switch (period) {
        case 'this_month':
            return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now }
        case 'last_month': {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const end = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, -1)
            return { start, end }
        }
        case 'last_3_months':
            return { start: subtractMonths(now, 3), end: now }
        case 'last_6_months':
            return { start: subtractMonths(now, 6), end: now }
        case 'this_year':
            return { start: new Date(now.getFullYear(), 0, 1), end: now }
        case 'custom': {
            const start = from ? new Date(from) : null
            const to_ = to ? endOfDay(new Date(to)) : null
            return {
                start: start && !Number.isNaN(start.getTime()) ? start : null,
                end: to_ && !Number.isNaN(to_.getTime()) ? to_ : null
            }
        }
        case 'all':
        default:
            return { start: null, end: null }
    }
}

// ── Formatting helpers ───────────────────────────────────────────────────────

function ddmmyyyy(d: Date): string {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function platformFee(amountVnd: number): number {
    return Math.floor((amountVnd * PLATFORM_FEE_PCT) / 100)
}

// ── Table builders (pure) ────────────────────────────────────────────────────

export function buildTransactionsTable(orders: ReportOrderRow[]): ReportTable {
    return {
        sheetName: 'Transactions',
        columns: [
            { header: 'Order ID', key: 'orderId', width: 14 },
            { header: 'Gig Title', key: 'gigTitle', width: 40 },
            { header: 'Buyer', key: 'buyer', width: 22 },
            { header: 'Seller', key: 'seller', width: 22 },
            { header: 'Amount (₫)', key: 'amount', width: 16 },
            { header: 'Platform Fee (₫)', key: 'platformFee', width: 16 },
            { header: 'Seller Payout (₫)', key: 'sellerPayout', width: 16 },
            { header: 'Status', key: 'status', width: 16 },
            { header: 'Order Date', key: 'orderDate', width: 14 },
            { header: 'Completion Date', key: 'completionDate', width: 16 }
        ],
        rows: orders.map((o) => {
            const fee = platformFee(o.amountVnd)
            return {
                orderId: formatOrderCode(o.number),
                gigTitle: o.gigTitle,
                buyer: o.buyerName,
                seller: o.sellerName,
                amount: o.amountVnd,
                platformFee: fee,
                sellerPayout: o.amountVnd - fee,
                status: o.status,
                orderDate: ddmmyyyy(o.placedAt),
                completionDate: o.completedAt ? ddmmyyyy(o.completedAt) : '—'
            }
        })
    }
}

export function buildTopSellersTable(sellers: SellerAggregateRow[]): ReportTable {
    return {
        sheetName: 'Top Sellers',
        columns: [
            { header: 'Rank', key: 'rank', width: 8 },
            { header: 'Name', key: 'name', width: 24 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Total Revenue (₫)', key: 'totalRevenue', width: 18 },
            { header: 'Platform Fees (₫)', key: 'platformFees', width: 18 },
            { header: 'Orders Completed', key: 'ordersCompleted', width: 16 },
            { header: 'Average Rating', key: 'averageRating', width: 14 },
            { header: 'Endorsed Status', key: 'endorsedStatus', width: 16 }
        ],
        rows: sellers.map((s, i) => ({
            rank: i + 1,
            name: s.name,
            email: s.email ?? '—',
            totalRevenue: s.grossVnd,
            platformFees: s.platformFeesVnd,
            ordersCompleted: s.ordersCompleted,
            averageRating: s.avgRating != null ? Number(s.avgRating.toFixed(1)) : 'New',
            endorsedStatus: s.endorsed ? 'Endorsed' : 'Not endorsed'
        }))
    }
}
