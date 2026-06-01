import { DateRange, ReportType } from '../report.types'

export const REPORT_REPOSITORY_PORT = 'REPORT_REPOSITORY_PORT'

export interface ReportOrderRow {
    number: number
    gigTitle: string
    buyerName: string
    sellerName: string
    amountVnd: number
    status: string
    placedAt: Date
    completedAt: Date | null
}

export interface SellerAggregateRow {
    sellerId: string
    name: string
    email: string | null
    grossVnd: number
    platformFeesVnd: number
    ordersCompleted: number
    avgRating: number | null
    endorsed: boolean
}

export interface RecordExportInput {
    adminUserId: string
    reportType: ReportType
    period: string
    filename: string
}

export interface ReportExportItem {
    id: string
    reportType: string
    period: string
    filename: string
    adminEmail: string | null
    createdAt: Date
}

export interface ReportRepositoryPort {
    // Orders placed within the range (any status) for the Transactions report.
    getTransactionOrders(range: DateRange): Promise<ReportOrderRow[]>
    // Per-seller aggregates over orders completed within the range.
    getTopSellerAggregates(range: DateRange): Promise<SellerAggregateRow[]>
    recordExport(input: RecordExportInput): Promise<void>
    listRecentExports(limit: number): Promise<ReportExportItem[]>
}
