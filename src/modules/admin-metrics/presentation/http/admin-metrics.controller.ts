import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'

import { AdminOnly } from '@/shared/infrastructure'
import { UploadService } from '@/shared/infrastructure/storage/upload.service'
import { ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { getFullUrl, validateAndTransform } from '@/shared/utils'

import { GetDashboardQuery } from '../../application'
import type { DashboardResult } from '../../application'
import { RevenuePeriod } from '../../domain/ports/admin-metrics.repository.port'
import { DashboardResponseDto } from './dto'

const PERIODS: RevenuePeriod[] = ['7d', '30d', '90d', '1y', 'all']

@ApiTags('Admin / Dashboard')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'admin/dashboard', version: '1' })
@AdminOnly()
export class AdminMetricsController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly configService: ConfigService,
        private readonly uploadService: UploadService
    ) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Admin dashboard metrics (stat cards, revenue series, category mix, activity, sellers)' })
    @ApiQuery({ name: 'period', required: false, enum: PERIODS })
    @ApiResponse({ status: 200, type: DashboardResponseDto })
    async dashboard(@Query('period') period?: string): Promise<ServiceResponse<DashboardResponseDto>> {
        const result: DashboardResult = await this.queryBus.execute(
            new GetDashboardQuery((PERIODS.includes(period as RevenuePeriod) ? period : '30d') as RevenuePeriod)
        )

        const topSellers = await Promise.all(
            result.topSellers.map(async (s) => ({
                id: s.id,
                displayName: s.displayName,
                username: s.username,
                avatarUrl: await this.resolveAvatar(s.avatarKey),
                earningsVnd: s.earningsVnd
            }))
        )

        const dto = validateAndTransform(DashboardResponseDto, {
            statCards: result.statCards,
            revenueSeries: result.revenueSeries,
            categoryDistribution: result.categoryDistribution,
            topSellers,
            actionRequired: result.actionRequired,
            recentActivity: result.recentActivity.map((a) => ({
                id: a.id,
                actionType: a.actionType,
                targetType: a.targetType,
                targetId: a.targetId,
                summary: a.summary,
                metadata: a.metadata,
                adminEmail: a.adminEmail,
                createdAt: a.createdAt.toISOString()
            }))
        })
        return createResponse(
            RESPONSE_CODES.ADMIN_DASHBOARD_SUCCESS,
            RESPONSE_TYPES.ADMIN_DASHBOARD,
            MESSAGES.ADMIN_DASHBOARD.FETCHED,
            dto
        )
    }

    private async resolveAvatar(key: string | null): Promise<string | null> {
        if (!key) return null
        try {
            const url = await this.uploadService.getSignedReadUrl(key)
            return getFullUrl(url, this.configService.get<string>('app.baseUrl'))
        } catch {
            return null
        }
    }
}
