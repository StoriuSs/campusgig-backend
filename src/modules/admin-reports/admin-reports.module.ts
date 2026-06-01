import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

import { REPORT_REPOSITORY_PORT } from './domain/ports/report.repository.port'
import { PrismaReportRepository } from './infrastructure/persistence/prisma-report.repository'
import {
    GetTransactionsReportHandler,
    GetTopSellersReportHandler,
    ListRecentExportsHandler,
    RecordExportHandler
} from './application'
import { AdminReportsController } from './presentation/http/admin-reports.controller'

const QueryHandlers = [GetTransactionsReportHandler, GetTopSellersReportHandler, ListRecentExportsHandler]
const CommandHandlers = [RecordExportHandler]

// Excel report exports (exceljs) + the Recent Exports history table.
@Module({
    imports: [CqrsModule],
    controllers: [AdminReportsController],
    providers: [
        { provide: REPORT_REPOSITORY_PORT, useClass: PrismaReportRepository },
        ...QueryHandlers,
        ...CommandHandlers
    ]
})
export class AdminReportsModule {}
