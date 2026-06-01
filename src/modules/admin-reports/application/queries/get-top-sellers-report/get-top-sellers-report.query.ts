import { DateRange } from '../../../domain/report.types'

export class GetTopSellersReportQuery {
    constructor(public readonly range: DateRange) {}
}
