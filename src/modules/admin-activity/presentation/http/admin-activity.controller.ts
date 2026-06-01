import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'

import { AdminOnly } from '@/shared/infrastructure'
import { ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform } from '@/shared/utils'

import { AdminActivityFilter } from '../../domain/admin-activity.types'
import { ListActivityQuery } from '../../application'
import type { ListActivityResult } from '../../application'
import { AdminActivityListResponseDto } from './dto'

const PAGE_SIZE = 10
const FILTERS: AdminActivityFilter[] = [
    'all',
    'gig_approvals',
    'gig_rejections',
    'dispute_verdicts',
    'withdrawals',
    'endorsements',
    'categories'
]

function parseDate(value?: string): Date | undefined {
    if (!value) return undefined
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? undefined : d
}

@ApiTags('Admin / Activity Log')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'admin/activity', version: '1' })
@AdminOnly()
export class AdminActivityController {
    constructor(private readonly queryBus: QueryBus) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List admin activity log (paginated, filterable)' })
    @ApiQuery({ name: 'filter', required: false, enum: FILTERS })
    @ApiQuery({ name: 'adminUserId', required: false, type: String })
    @ApiQuery({ name: 'from', required: false, type: String, description: 'ISO date-time lower bound' })
    @ApiQuery({ name: 'to', required: false, type: String, description: 'ISO date-time upper bound' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiResponse({ status: 200, type: AdminActivityListResponseDto })
    async list(
        @Query('filter') filter?: string,
        @Query('adminUserId') adminUserId?: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('page') page?: string
    ): Promise<ServiceResponse<AdminActivityListResponseDto>> {
        const parsedPage = Math.max(1, Number.parseInt(page ?? '1', 10) || 1)
        const result: ListActivityResult = await this.queryBus.execute(
            new ListActivityQuery(
                (FILTERS.includes(filter as AdminActivityFilter) ? filter : 'all') as AdminActivityFilter,
                adminUserId || undefined,
                parseDate(from),
                parseDate(to),
                parsedPage,
                PAGE_SIZE
            )
        )

        const dto = validateAndTransform(AdminActivityListResponseDto, {
            items: result.items.map((r) => ({
                id: r.id,
                actionType: r.actionType,
                targetType: r.targetType,
                targetId: r.targetId,
                summary: r.summary,
                metadata: r.metadata,
                adminUserId: r.adminUserId,
                adminEmail: r.adminEmail,
                createdAt: r.createdAt.toISOString()
            })),
            total: result.total,
            page: parsedPage,
            pageSize: PAGE_SIZE,
            admins: result.admins
        })
        return createResponse(
            RESPONSE_CODES.ADMIN_ACTIVITY_LIST_SUCCESS,
            RESPONSE_TYPES.ADMIN_ACTIVITY_LIST,
            MESSAGES.ADMIN_ACTIVITY.LISTED,
            dto
        )
    }
}
