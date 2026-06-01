import { Injectable } from '@nestjs/common'

import { PrismaService } from '@/shared/infrastructure'

import { DateRange } from '../../domain/report.types'
import {
    RecordExportInput,
    ReportExportItem,
    ReportOrderRow,
    ReportRepositoryPort,
    SellerAggregateRow
} from '../../domain/ports/report.repository.port'
import { platformFee } from '../../application/report-rows'

function displayNameOf(u: { displayName: string | null; username: string | null; email: string | null }): string {
    return u.displayName ?? u.username ?? u.email ?? '—'
}

@Injectable()
export class PrismaReportRepository implements ReportRepositoryPort {
    constructor(private readonly prisma: PrismaService) {}

    async getTransactionOrders(range: DateRange): Promise<ReportOrderRow[]> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {}
        if (range.start || range.end) {
            where.placedAt = {}
            if (range.start) where.placedAt.gte = range.start
            if (range.end) where.placedAt.lte = range.end
        }

        const orders = await this.prisma.order.findMany({
            where,
            orderBy: { placedAt: 'desc' },
            select: {
                number: true,
                gigTitleSnapshot: true,
                gigPriceVndSnapshot: true,
                status: true,
                placedAt: true,
                completedAt: true,
                autoCompletedAt: true,
                buyer: { select: { displayName: true, username: true, email: true } },
                seller: { select: { displayName: true, username: true, email: true } }
            }
        })

        return orders.map((o) => ({
            number: o.number,
            gigTitle: o.gigTitleSnapshot,
            buyerName: displayNameOf(o.buyer),
            sellerName: displayNameOf(o.seller),
            amountVnd: o.gigPriceVndSnapshot,
            status: o.status,
            placedAt: o.placedAt,
            completedAt: o.completedAt ?? o.autoCompletedAt ?? null
        }))
    }

    async getTopSellerAggregates(range: DateRange): Promise<SellerAggregateRow[]> {
        const orders = await this.prisma.order.findMany({
            where: { status: 'Completed' },
            select: {
                sellerId: true,
                gigPriceVndSnapshot: true,
                completedAt: true,
                autoCompletedAt: true,
                seller: {
                    select: {
                        displayName: true,
                        username: true,
                        email: true,
                        endorsedAt: true,
                        reviewCount: true,
                        ratingSumHalfStars: true
                    }
                }
            }
        })

        const acc = new Map<string, SellerAggregateRow>()
        for (const o of orders) {
            const completion = o.completedAt ?? o.autoCompletedAt
            if (!completion) continue
            if (range.start && completion < range.start) continue
            if (range.end && completion > range.end) continue

            let row = acc.get(o.sellerId)
            if (!row) {
                const s = o.seller
                row = {
                    sellerId: o.sellerId,
                    name: displayNameOf(s),
                    email: s.email,
                    grossVnd: 0,
                    platformFeesVnd: 0,
                    ordersCompleted: 0,
                    avgRating: s.reviewCount > 0 ? s.ratingSumHalfStars / 2 / s.reviewCount : null,
                    endorsed: s.endorsedAt != null
                }
                acc.set(o.sellerId, row)
            }
            row.grossVnd += o.gigPriceVndSnapshot
            row.platformFeesVnd += platformFee(o.gigPriceVndSnapshot)
            row.ordersCompleted += 1
        }

        return Array.from(acc.values()).sort((a, b) => b.grossVnd - a.grossVnd)
    }

    async recordExport(input: RecordExportInput): Promise<void> {
        await this.prisma.reportExport.create({
            data: {
                adminUserId: input.adminUserId,
                reportType: input.reportType,
                period: input.period,
                filename: input.filename
            }
        })
    }

    async listRecentExports(limit: number): Promise<ReportExportItem[]> {
        const rows = await this.prisma.reportExport.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { admin: { select: { email: true } } }
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return rows.map((r: any) => ({
            id: r.id,
            reportType: r.reportType,
            period: r.period,
            filename: r.filename,
            adminEmail: r.admin?.email ?? null,
            createdAt: r.createdAt
        }))
    }
}
