import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'

import { AdminOnly, CurrentUser } from '@/shared/infrastructure'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { formatOrderCode, validateAndTransform } from '@/shared/utils'

import { GIG_STORAGE_PORT, GigStoragePort } from '@/modules/gigs/application/ports'
import { DELIVERY_STORAGE_PORT, DeliveryStoragePort } from '@/modules/orders/domain/ports'

import { GetAdminDisputeQuery, ListAdminDisputesQuery, ResolveDisputeCommand } from '../../application'
import type { AdminDisputeDetailResult } from '../../application/queries/get-admin-dispute/get-admin-dispute.handler'
import {
    AdminDisputeListResult,
    AdminDisputeParty,
    AdminDisputePartySummary,
    AdminEvidenceItem
} from '../../domain/ports/disputes.repository.port'
import { DisputeVerdict } from '../../domain/dispute.types'
import {
    AdminDisputeDetailResponseDto,
    AdminDisputeListResponseDto,
    AdminDisputePartyDto,
    AdminEvidenceDto,
    SubmitVerdictRequestDto
} from './dto'

const FILE_URL_TTL = 3600
const PAGE_SIZE = 10

@ApiTags('Admin / Disputes')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'admin/disputes', version: '1' })
@AdminOnly()
export class AdminDisputesController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
        @Inject(GIG_STORAGE_PORT) private readonly imageStorage: GigStoragePort,
        @Inject(DELIVERY_STORAGE_PORT) private readonly fileStorage: DeliveryStoragePort
    ) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List disputes for moderation' })
    @ApiQuery({ name: 'status', required: false, enum: ['ready', 'awaiting', 'resolved', 'all'] })
    @ApiQuery({ name: 'filedBy', required: false, enum: ['all', 'buyer', 'seller'] })
    @ApiQuery({ name: 'sort', required: false, enum: ['oldest', 'newest', 'amount_desc'] })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiResponse({ status: 200, type: AdminDisputeListResponseDto })
    async list(
        @Query('status') status?: string,
        @Query('filedBy') filedBy?: string,
        @Query('sort') sort?: string,
        @Query('page') page?: string
    ): Promise<ServiceResponse<AdminDisputeListResponseDto>> {
        const parsedPage = Math.max(1, Number.parseInt(page ?? '1', 10) || 1)
        const result: AdminDisputeListResult = await this.queryBus.execute(
            new ListAdminDisputesQuery({
                status: (['ready', 'awaiting', 'resolved', 'all'].includes(status ?? '') ? status : 'ready') as
                    | 'ready'
                    | 'awaiting'
                    | 'resolved'
                    | 'all',
                filedBy: (['all', 'buyer', 'seller'].includes(filedBy ?? '') ? filedBy : 'all') as
                    | 'all'
                    | 'buyer'
                    | 'seller',
                sort: (['oldest', 'newest', 'amount_desc'].includes(sort ?? '') ? sort : 'oldest') as
                    | 'oldest'
                    | 'newest'
                    | 'amount_desc',
                page: parsedPage,
                pageSize: PAGE_SIZE
            })
        )

        const items = await Promise.all(
            result.items.map(async (r) => ({
                orderId: r.orderId,
                code: formatOrderCode(r.number),
                number: r.number,
                gigTitle: r.gigTitle,
                status: r.status,
                filedByRole: r.filedByRole,
                filedAt: r.filedAt.toISOString(),
                responseDeadline: r.responseDeadline.toISOString(),
                amountVnd: r.amountVnd,
                buyer: await this.toPartySummary(r.buyer),
                seller: await this.toPartySummary(r.seller)
            }))
        )

        const dto = validateAndTransform(AdminDisputeListResponseDto, {
            items,
            total: result.total,
            page: parsedPage,
            pageSize: PAGE_SIZE,
            counts: result.counts
        })
        return createResponse(
            RESPONSE_CODES.ADMIN_DISPUTES_LIST_SUCCESS,
            RESPONSE_TYPES.ADMIN_DISPUTES_LIST,
            MESSAGES.DISPUTE.LISTED,
            dto
        )
    }

    @Get(':orderId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Full dispute review detail' })
    @ApiResponse({ status: 200, type: AdminDisputeDetailResponseDto })
    async detail(@Param('orderId') orderId: string): Promise<ServiceResponse<AdminDisputeDetailResponseDto>> {
        const { detail, chat }: AdminDisputeDetailResult = await this.queryBus.execute(
            new GetAdminDisputeQuery(orderId)
        )

        const [filer, counterparty, deliveries] = await Promise.all([
            this.toPartyDto(detail.filer),
            this.toPartyDto(detail.counterparty),
            Promise.all(
                detail.deliveries.map(async (dl) => ({
                    id: dl.id,
                    version: dl.version,
                    note: dl.note,
                    deliveredAt: dl.deliveredAt.toISOString(),
                    files: await Promise.all(
                        dl.files.map(async (f) => ({
                            id: f.id,
                            name: f.name,
                            size: f.size,
                            mime: f.mime,
                            url: await this.fileStorage.presignGetUrl(f.fileKey, FILE_URL_TTL),
                            downloadUrl: await this.fileStorage.presignGetUrl(f.fileKey, FILE_URL_TTL, f.name)
                        }))
                    )
                }))
            )
        ])

        const dto = validateAndTransform(AdminDisputeDetailResponseDto, {
            orderId: detail.orderId,
            code: formatOrderCode(detail.number),
            number: detail.number,
            gigId: detail.gigId,
            status: detail.status,
            amountVnd: detail.amountVnd,
            gigTitle: detail.gigTitle,
            placedAt: detail.placedAt.toISOString(),
            filedAt: detail.filedAt.toISOString(),
            respondedAt: detail.respondedAt?.toISOString() ?? null,
            responseDeadline: detail.responseDeadline.toISOString(),
            filer,
            counterparty,
            verdict: detail.verdict,
            buyerRefundPercent: detail.buyerRefundPercent,
            adminNotes: detail.adminNotes,
            resolvedAt: detail.resolvedAt?.toISOString() ?? null,
            payout: detail.payout,
            deliveries,
            chat: chat.map((m) => ({
                id: m.id,
                senderId: m.senderId,
                body: m.body,
                createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt
            }))
        })
        return createResponse(
            RESPONSE_CODES.ADMIN_DISPUTE_FETCH_SUCCESS,
            RESPONSE_TYPES.ADMIN_DISPUTE_FETCH,
            MESSAGES.DISPUTE.FETCHED,
            dto
        )
    }

    @Post(':orderId/verdict')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Submit an admin verdict (moves escrow, lands terminal status)' })
    @ApiResponse({ status: 200, description: 'Verdict submitted' })
    async verdict(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId') orderId: string,
        @Body() dto: SubmitVerdictRequestDto
    ): Promise<ServiceResponse<null>> {
        await this.commandBus.execute(
            new ResolveDisputeCommand(
                orderId,
                user.local.dbId,
                dto.verdict as DisputeVerdict,
                dto.buyerRefundPercent ?? null,
                dto.adminNotes ?? null
            )
        )
        return createResponse(
            RESPONSE_CODES.ADMIN_DISPUTE_VERDICT_SUCCESS,
            RESPONSE_TYPES.ADMIN_DISPUTE_VERDICT,
            MESSAGES.DISPUTE.RESOLVED,
            null
        )
    }

    // ── Mapping helpers ──────────────────────────────────────────────────────

    private async resolveAvatar(key: string | null): Promise<string | null> {
        if (!key) return null
        try {
            return await this.imageStorage.getSignedReadUrl(key)
        } catch {
            return null
        }
    }

    private async toPartySummary(p: AdminDisputePartySummary) {
        return {
            id: p.id,
            username: p.username,
            displayName: p.displayName,
            avatarUrl: await this.resolveAvatar(p.avatarKey)
        }
    }

    private async toEvidenceDto(e: AdminEvidenceItem): Promise<AdminEvidenceDto> {
        return validateAndTransform(AdminEvidenceDto, {
            id: e.id,
            side: e.side,
            name: e.name,
            size: e.size,
            mime: e.mime,
            url: await this.fileStorage.presignGetUrl(e.fileKey, FILE_URL_TTL),
            downloadUrl: await this.fileStorage.presignGetUrl(e.fileKey, FILE_URL_TTL, e.name)
        })
    }

    private async toPartyDto(p: AdminDisputeParty): Promise<AdminDisputePartyDto> {
        const avatarUrl = await this.resolveAvatar(p.avatarKey)
        const evidence = await Promise.all(p.evidence.map((e) => this.toEvidenceDto(e)))
        return validateAndTransform(AdminDisputePartyDto, {
            userId: p.userId,
            username: p.username,
            displayName: p.displayName,
            avatarUrl,
            endorsed: p.endorsedAt != null,
            avgRating: p.reviewCount > 0 ? p.ratingSumHalfStars / 2 / p.reviewCount : null,
            reviewCount: p.reviewCount,
            role: p.role,
            reasonCode: p.reasonCode,
            statement: p.statement,
            evidence
        })
    }
}
