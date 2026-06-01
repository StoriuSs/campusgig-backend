import { Inject } from '@nestjs/common'
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'

import { REPORT_REPOSITORY_PORT, ReportRepositoryPort } from '../../../domain/ports/report.repository.port'
import { RecordExportCommand } from './record-export.command'

@CommandHandler(RecordExportCommand)
export class RecordExportHandler implements ICommandHandler<RecordExportCommand> {
    constructor(@Inject(REPORT_REPOSITORY_PORT) private readonly repo: ReportRepositoryPort) {}

    execute(command: RecordExportCommand): Promise<void> {
        return this.repo.recordExport({
            adminUserId: command.adminUserId,
            reportType: command.reportType,
            period: command.period,
            filename: command.filename
        })
    }
}
