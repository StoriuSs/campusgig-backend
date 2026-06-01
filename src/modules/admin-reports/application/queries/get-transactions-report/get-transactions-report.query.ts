import { DateRange } from '../../../domain/report.types'

export class GetTransactionsReportQuery {
    constructor(public readonly range: DateRange) {}
}
