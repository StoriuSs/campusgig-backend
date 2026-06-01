import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import { ReportTable } from '../../../domain/report.types'
import { REPORT_REPOSITORY_PORT, ReportRepositoryPort } from '../../../domain/ports/report.repository.port'
import { buildTransactionsTable } from '../../report-rows'
import { GetTransactionsReportQuery } from './get-transactions-report.query'

@QueryHandler(GetTransactionsReportQuery)
export class GetTransactionsReportHandler implements IQueryHandler<GetTransactionsReportQuery> {
    constructor(@Inject(REPORT_REPOSITORY_PORT) private readonly repo: ReportRepositoryPort) {}

    async execute(query: GetTransactionsReportQuery): Promise<ReportTable> {
        const orders = await this.repo.getTransactionOrders(query.range)
        return buildTransactionsTable(orders)
    }
}
