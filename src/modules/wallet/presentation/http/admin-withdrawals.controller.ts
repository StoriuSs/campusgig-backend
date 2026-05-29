import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ConfigService } from '@nestjs/config'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'

import { AdminOnly, CurrentUser } from '@/shared/infrastructure'
import { Idempotent } from '@/shared/presentation/decorators'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform, getFullUrl } from '@/shared/utils'
import { GigStoragePort, GIG_STORAGE_PORT } from '@/modules/gigs/application/ports'

import {
    ApproveWithdrawalCommand,
    GetWithdrawalDetailAdminQuery,
    ListPendingWithdrawalsAdminQuery,
    ListProcessedWithdrawalsAdminQuery,
    RejectWithdrawalCommand
} from '../../application'
import type { AdminWithdrawalsListWithSummary } from '../../application'
import type { WithdrawalRequestItem, WithdrawalSort } from '../../domain/ports/wallet.repository.port'
import { AdminWithdrawalRowDto, AdminWithdrawalsListResponseDto, RejectWithdrawalRequestDto } from './dto'

const VALID_SORTS: WithdrawalSort[] = ['newest', 'oldest', 'amountDesc', 'amountAsc']

function toRowDto(item: WithdrawalRequestItem, avatarUrl: string | null): AdminWithdrawalRowDto {
    return validateAndTransform(AdminWithdrawalRowDto, {
        id: item.id,
        transactionId: item.transactionId,
        user: {
            id: item.user.id,
            username: item.user.username,
            displayName: item.user.displayName,
            avatarUrl,
            isEndorsed: item.user.isEndorsed,
            memberSince: item.user.memberSince.toISOString(),
            walletBalance: item.user.walletBalance,
            pendingWithdrawalBalance: item.user.pendingWithdrawalBalance
        },
        amountVnd: item.amountVnd,
        bankName: item.bankName,
        bankAccountNumber: item.bankAccountNumber,
        bankAccountHolder: item.bankAccountHolder,
        availableBalanceSnapshot: item.availableBalanceSnapshot,
        status: item.status,
        rejectionReason: item.rejectionReason,
        rejectionNote: item.rejectionNote,
        requestedAt: item.requestedAt.toISOString(),
        processedAt: item.processedAt ? item.processedAt.toISOString() : null
    })
}

@ApiTags('Admin / Withdrawals')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'admin/withdrawals', version: '1' })
@AdminOnly()
export class AdminWithdrawalsController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
        private readonly configService: ConfigService,
        @Inject(GIG_STORAGE_PORT) private readonly storage: GigStoragePort
    ) {}

    private async resolveKey(key: string | null): Promise<string | null> {
        if (!key) return null
        const url = await this.storage.getSignedReadUrl(key)
        return getFullUrl(url, this.configService.get<string>('app.baseUrl')) ?? url
    }

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List withdrawals (Pending or Processed)' })
    @ApiQuery({ name: 'status', required: false, enum: ['pending', 'completed', 'rejected'] })
    @ApiQuery({ name: 'sort', required: false, enum: ['newest', 'oldest', 'amountDesc', 'amountAsc'] })
    @ApiQuery({ name: 'q', required: false })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'pageSize', required: false, type: Number })
    @ApiResponse({ status: 200, type: AdminWithdrawalsListResponseDto })
    async list(
        @Query('status') statusParam?: string,
        @Query('sort') sortParam?: string,
        @Query('q') q?: string,
        @Query('page') pageParam?: string,
        @Query('pageSize') pageSizeParam?: string
    ): Promise<ServiceResponse<AdminWithdrawalsListResponseDto>> {
        const status: 'pending' | 'completed' | 'rejected' =
            statusParam === 'completed' ? 'completed' : statusParam === 'rejected' ? 'rejected' : 'pending'
        const sort: WithdrawalSort = VALID_SORTS.includes(sortParam as WithdrawalSort)
            ? (sortParam as WithdrawalSort)
            : 'newest'
        const page = Number.parseInt(pageParam ?? '1', 10) || 1
        const pageSize = Math.min(Number.parseInt(pageSizeParam ?? '10', 10) || 10, 50)

        const result: AdminWithdrawalsListWithSummary = await this.queryBus.execute(
            status === 'pending'
                ? new ListPendingWithdrawalsAdminQuery(sort, q?.trim() || undefined, page, pageSize)
                : new ListProcessedWithdrawalsAdminQuery(status, sort, q?.trim() || undefined, page, pageSize)
        )

        // Resolve avatar keys to signed S3 URLs. The storage adapter passes
        // already-fully-qualified URLs (e.g. seeded Picsum URLs) through unchanged.
        const items = await Promise.all(
            result.items.map(async (item) => {
                const avatarUrl = await this.resolveKey(item.user.avatarKey)
                return toRowDto(item, avatarUrl)
            })
        )

        const dto = validateAndTransform(AdminWithdrawalsListResponseDto, {
            items,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            summary: result.summary
        })

        return createResponse(
            RESPONSE_CODES.ADMIN_WITHDRAWALS_LIST_SUCCESS,
            RESPONSE_TYPES.ADMIN_WITHDRAWALS_LIST,
            MESSAGES.ADMIN_WITHDRAWALS.LISTED,
            dto
        )
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get withdrawal detail' })
    @ApiParam({ name: 'id' })
    @ApiResponse({ status: 200, type: AdminWithdrawalRowDto })
    async getDetail(@Param('id') id: string): Promise<ServiceResponse<AdminWithdrawalRowDto>> {
        const item: WithdrawalRequestItem = await this.queryBus.execute(new GetWithdrawalDetailAdminQuery(id))
        const avatarUrl = await this.resolveKey(item.user.avatarKey)
        const dto = toRowDto(item, avatarUrl)
        return createResponse(
            RESPONSE_CODES.ADMIN_WITHDRAWAL_FETCH_SUCCESS,
            RESPONSE_TYPES.ADMIN_WITHDRAWAL_FETCH,
            MESSAGES.ADMIN_WITHDRAWALS.FETCHED,
            dto
        )
    }

    @Post(':id/approve')
    @HttpCode(HttpStatus.OK)
    @Idempotent('5m')
    @ApiOperation({ summary: 'Approve a pending withdrawal' })
    @ApiResponse({ status: 200, type: AdminWithdrawalRowDto })
    async approve(
        @CurrentUser() admin: AuthenticatedKeycloakUser,
        @Param('id') id: string
    ): Promise<ServiceResponse<AdminWithdrawalRowDto>> {
        const updated: WithdrawalRequestItem = await this.commandBus.execute(
            new ApproveWithdrawalCommand(id, admin.local.dbId)
        )
        const avatarUrl = await this.resolveKey(updated.user.avatarKey)
        const dto = toRowDto(updated, avatarUrl)
        return createResponse(
            RESPONSE_CODES.ADMIN_WITHDRAWAL_APPROVE_SUCCESS,
            RESPONSE_TYPES.ADMIN_WITHDRAWAL_APPROVE,
            MESSAGES.ADMIN_WITHDRAWALS.APPROVED,
            dto
        )
    }

    @Post(':id/reject')
    @HttpCode(HttpStatus.OK)
    @Idempotent('5m')
    @ApiOperation({ summary: 'Reject a pending withdrawal' })
    @ApiResponse({ status: 200, type: AdminWithdrawalRowDto })
    async reject(
        @CurrentUser() admin: AuthenticatedKeycloakUser,
        @Param('id') id: string,
        @Body() dto: RejectWithdrawalRequestDto
    ): Promise<ServiceResponse<AdminWithdrawalRowDto>> {
        const updated: WithdrawalRequestItem = await this.commandBus.execute(
            new RejectWithdrawalCommand(id, admin.local.dbId, dto.reason, dto.note)
        )
        const avatarUrl = await this.resolveKey(updated.user.avatarKey)
        const out = toRowDto(updated, avatarUrl)
        return createResponse(
            RESPONSE_CODES.ADMIN_WITHDRAWAL_REJECT_SUCCESS,
            RESPONSE_TYPES.ADMIN_WITHDRAWAL_REJECT,
            MESSAGES.ADMIN_WITHDRAWALS.REJECTED,
            out
        )
    }
}
