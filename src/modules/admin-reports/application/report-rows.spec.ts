import { buildTopSellersTable, buildTransactionsTable, platformFee, resolvePeriodRange } from './report-rows'
import { ReportOrderRow, SellerAggregateRow } from '../domain/ports/report.repository.port'

describe('report-rows mappers', () => {
    describe('platformFee', () => {
        it('floors 20% of the amount', () => {
            expect(platformFee(150_000)).toBe(30_000)
            expect(platformFee(149_999)).toBe(29_999) // floor(29999.8)
        })
    })

    describe('buildTransactionsTable', () => {
        const orders: ReportOrderRow[] = [
            {
                number: 1042,
                gigTitle: 'Calculus tutoring',
                buyerName: 'Sarah J.',
                sellerName: 'Minh T.',
                amountVnd: 150_000,
                status: 'Completed',
                // Local-time fixtures so the DD/MM/YYYY assertion is timezone-stable.
                placedAt: new Date(2026, 4, 2, 9, 0, 0),
                completedAt: new Date(2026, 4, 5, 18, 30, 0)
            },
            {
                number: 1043,
                gigTitle: 'Logo design',
                buyerName: 'Alex',
                sellerName: 'Mai',
                amountVnd: 200_000,
                status: 'InProgress',
                placedAt: new Date(2026, 4, 10, 9, 0, 0),
                completedAt: null
            }
        ]

        it('maps every column, derives fee/payout, and formats DD/MM/YYYY dates', () => {
            const table = buildTransactionsTable(orders)
            expect(table.columns.map((c) => c.header)).toEqual([
                'Order ID',
                'Gig Title',
                'Buyer',
                'Seller',
                'Amount (₫)',
                'Platform Fee (₫)',
                'Seller Payout (₫)',
                'Status',
                'Order Date',
                'Completion Date'
            ])

            expect(table.rows[0]).toMatchObject({
                orderId: 'CG-1042',
                amount: 150_000,
                platformFee: 30_000,
                sellerPayout: 120_000,
                orderDate: '02/05/2026',
                completionDate: '05/05/2026'
            })
            // Open order has no completion date.
            expect(table.rows[1].completionDate).toBe('—')
        })
    })

    describe('buildTopSellersTable', () => {
        const sellers: SellerAggregateRow[] = [
            {
                sellerId: 's1',
                name: 'Minh T.',
                email: 'minh@uni.edu',
                grossVnd: 1_000_000,
                platformFeesVnd: 200_000,
                ordersCompleted: 8,
                avgRating: 4.84,
                endorsed: true
            },
            {
                sellerId: 's2',
                name: 'New Seller',
                email: null,
                grossVnd: 50_000,
                platformFeesVnd: 10_000,
                ordersCompleted: 1,
                avgRating: null,
                endorsed: false
            }
        ]

        it('ranks sellers and renders rating / endorsement / email fallbacks', () => {
            const table = buildTopSellersTable(sellers)
            expect(table.rows[0]).toMatchObject({
                rank: 1,
                averageRating: 4.8,
                endorsedStatus: 'Endorsed'
            })
            expect(table.rows[1]).toMatchObject({
                rank: 2,
                email: '—',
                averageRating: 'New',
                endorsedStatus: 'Not endorsed'
            })
        })
    })

    describe('resolvePeriodRange', () => {
        it('returns open bounds for all-time', () => {
            expect(resolvePeriodRange('all')).toEqual({ start: null, end: null })
        })

        it('bounds this_month to the first of the current month', () => {
            const { start, end } = resolvePeriodRange('this_month')
            expect(start).not.toBeNull()
            expect(start!.getDate()).toBe(1)
            expect(end).not.toBeNull()
        })

        it('parses a custom range and ignores invalid dates', () => {
            const ok = resolvePeriodRange('custom', '2026-01-01', '2026-03-31')
            expect(ok.start).not.toBeNull()
            expect(ok.end).not.toBeNull()

            const bad = resolvePeriodRange('custom', 'not-a-date', undefined)
            expect(bad.start).toBeNull()
            expect(bad.end).toBeNull()
        })
    })
})
