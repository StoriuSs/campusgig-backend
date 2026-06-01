import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import {
    REPORT_REPOSITORY_PORT,
    ReportExportItem,
    ReportRepositoryPort
} from '../../../domain/ports/report.repository.port'
import { ListRecentExportsQuery } from './list-recent-exports.query'

@QueryHandler(ListRecentExportsQuery)
export class ListRecentExportsHandler implements IQueryHandler<ListRecentExportsQuery> {
    constructor(@Inject(REPORT_REPOSITORY_PORT) private readonly repo: ReportRepositoryPort) {}

    execute(query: ListRecentExportsQuery): Promise<ReportExportItem[]> {
        return this.repo.listRecentExports(query.limit)
    }
}
