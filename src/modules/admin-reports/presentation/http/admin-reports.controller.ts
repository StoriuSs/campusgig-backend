import { Controller, Get, HttpCode, HttpStatus, Query, Res } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'

import { AdminOnly, CurrentUser } from '@/shared/infrastructure'
import { RawResponse } from '@/shared/presentation/decorators'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform } from '@/shared/utils'

import { ReportPeriod, ReportTable, ReportType } from '../../domain/report.types'
import {
    GetTopSellersReportQuery,
    GetTransactionsReportQuery,
    ListRecentExportsQuery,
    RecordExportCommand,
    resolvePeriodRange
} from '../../application'
import type { ReportExportItem } from '../../domain/ports/report.repository.port'
import { buildWorkbookBuffer } from '../../infrastructure/xlsx.builder'
import { RecentExportsResponseDto } from './dto'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const RECENT_EXPORTS_LIMIT = 10
const PERIODS: ReportPeriod[] = [
    'this_month',
    'last_month',
    'last_3_months',
    'last_6_months',
    'this_year',
    'all',
    'custom'
]

@ApiTags('Admin / Reports')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'admin/reports', version: '1' })
@AdminOnly()
export class AdminReportsController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus
    ) {}

    @Get('transactions')
    @RawResponse()
    @ApiOperation({ summary: 'Export the Transactions report as .xlsx' })
    @ApiProduces(XLSX_MIME)
    @ApiQuery({ name: 'period', required: false, enum: PERIODS })
    @ApiQuery({ name: 'from', required: false, type: String })
    @ApiQuery({ name: 'to', required: false, type: String })
    async transactions(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Res() res: Response,
        @Query('period') period?: string,
        @Query('from') from?: string,
        @Query('to') to?: string
    ): Promise<void> {
        const resolvedPeriod = this.parsePeriod(period)
        const table: ReportTable = await this.queryBus.execute(
            new GetTransactionsReportQuery(resolvePeriodRange(resolvedPeriod, from, to))
        )
        await this.stream(res, user, table, 'transactions', resolvedPeriod)
    }

    @Get('top-sellers')
    @RawResponse()
    @ApiOperation({ summary: 'Export the Top Sellers report as .xlsx' })
    @ApiProduces(XLSX_MIME)
    @ApiQuery({ name: 'period', required: false, enum: PERIODS })
    @ApiQuery({ name: 'from', required: false, type: String })
    @ApiQuery({ name: 'to', required: false, type: String })
    async topSellers(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Res() res: Response,
        @Query('period') period?: string,
        @Query('from') from?: string,
        @Query('to') to?: string
    ): Promise<void> {
        const resolvedPeriod = this.parsePeriod(period)
        const table: ReportTable = await this.queryBus.execute(
            new GetTopSellersReportQuery(resolvePeriodRange(resolvedPeriod, from, to))
        )
        await this.stream(res, user, table, 'top_sellers', resolvedPeriod)
    }

    @Get('exports')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List recent report exports' })
    @ApiResponse({ status: 200, type: RecentExportsResponseDto })
    async exports(): Promise<ServiceResponse<RecentExportsResponseDto>> {
        const items: ReportExportItem[] = await this.queryBus.execute(new ListRecentExportsQuery(RECENT_EXPORTS_LIMIT))
        const dto = validateAndTransform(RecentExportsResponseDto, {
            items: items.map((e) => ({
                id: e.id,
                reportType: e.reportType,
                period: e.period,
                filename: e.filename,
                adminEmail: e.adminEmail,
                createdAt: e.createdAt.toISOString()
            }))
        })
        return createResponse(
            RESPONSE_CODES.ADMIN_REPORT_EXPORTS_LIST_SUCCESS,
            RESPONSE_TYPES.ADMIN_REPORT_EXPORTS_LIST,
            MESSAGES.ADMIN_REPORTS.EXPORTS_LISTED,
            dto
        )
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private parsePeriod(period?: string): ReportPeriod {
        return (PERIODS.includes(period as ReportPeriod) ? period : 'this_month') as ReportPeriod
    }

    private async stream(
        res: Response,
        user: AuthenticatedKeycloakUser,
        table: ReportTable,
        reportType: ReportType,
        period: ReportPeriod
    ): Promise<void> {
        const buffer = await buildWorkbookBuffer(table)
        const stamp = Math.floor(Date.now() / 1000)
        const slug = reportType.replace(/_/g, '-')
        const filename = `campusgig-${slug}-${stamp}.xlsx`

        await this.commandBus.execute(new RecordExportCommand(user.local.dbId, reportType, period, filename))

        res.set({
            'Content-Type': XLSX_MIME,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': buffer.length.toString()
        })
        res.end(buffer)
    }
}
