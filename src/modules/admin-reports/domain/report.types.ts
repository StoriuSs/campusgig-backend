export type ReportType = 'transactions' | 'top_sellers'

export type ReportPeriod =
    | 'this_month'
    | 'last_month'
    | 'last_3_months'
    | 'last_6_months'
    | 'this_year'
    | 'all'
    | 'custom'

// null bound = open-ended (no lower/upper limit).
export interface DateRange {
    start: Date | null
    end: Date | null
}

export interface ReportColumn {
    header: string
    key: string
    width: number
}

// A fully-resolved, render-ready table. The xlsx builder turns this into bytes;
// the row values are produced by pure mappers (unit-tested without exceljs).
export interface ReportTable {
    sheetName: string
    columns: ReportColumn[]
    rows: Record<string, string | number>[]
}
