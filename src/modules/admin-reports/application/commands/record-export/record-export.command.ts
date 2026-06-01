import { ReportType } from '../../../domain/report.types'

export class RecordExportCommand {
    constructor(
        public readonly adminUserId: string,
        public readonly reportType: ReportType,
        public readonly period: string,
        public readonly filename: string
    ) {}
}
