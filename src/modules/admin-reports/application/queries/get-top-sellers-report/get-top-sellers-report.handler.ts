import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import { ReportTable } from '../../../domain/report.types'
import { REPORT_REPOSITORY_PORT, ReportRepositoryPort } from '../../../domain/ports/report.repository.port'
import { buildTopSellersTable } from '../../report-rows'
import { GetTopSellersReportQuery } from './get-top-sellers-report.query'

@QueryHandler(GetTopSellersReportQuery)
export class GetTopSellersReportHandler implements IQueryHandler<GetTopSellersReportQuery> {
    constructor(@Inject(REPORT_REPOSITORY_PORT) private readonly repo: ReportRepositoryPort) {}

    async execute(query: GetTopSellersReportQuery): Promise<ReportTable> {
        const sellers = await this.repo.getTopSellerAggregates(query.range)
        return buildTopSellersTable(sellers)
    }
}
