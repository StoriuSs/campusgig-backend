import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus, UseFilters, Inject } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ConfigService } from '@nestjs/config'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger'

import { AdminOnly, CurrentUser } from '@/shared/infrastructure'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform, getFullUrl } from '@/shared/utils'

import {
    RejectGigRequestDto,
    AdminQueueRowDto,
    AdminQueueSellerDto,
    AdminQueueCountsDto,
    AdminGigQueueResponseDto,
    AdminGigDetailDto,
    AdminGigDetailSellerDto,
    GigImageDto,
    GigBulletDto,
    GigFaqDto
} from './dto'
import {
    ListAdminGigQueueQuery,
    GetAdminGigByIdQuery,
    ApproveGigCommand,
    RejectGigCommand
} from '@/modules/gigs/application'
import type { ListAdminGigQueueResult } from '@/modules/gigs/application/queries/list-admin-gig-queue/list-admin-gig-queue.handler'
import { AdminGigDetail, AdminQueueRow, AdminQueueStatusFilter, AdminQueueSort } from '@/modules/gigs/domain'
import { GigStoragePort, GIG_STORAGE_PORT } from '@/modules/gigs/application/ports'
import { GigsDomainExceptionFilter } from '../filters/gigs-domain-exception.filter'

@ApiTags('Admin / Gigs')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'admin/gigs', version: '1' })
@AdminOnly()
@UseFilters(GigsDomainExceptionFilter)
export class AdminGigsController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
        private readonly configService: ConfigService,
        @Inject(GIG_STORAGE_PORT) private readonly storage: GigStoragePort
    ) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'List the admin gig queue',
        description: 'Paginated, filterable list of gigs for moderation. Default status is Pending.'
    })
    @ApiQuery({ name: 'status', required: false, enum: ['all', 'pending', 'approved', 'rejected'] })
    @ApiQuery({ name: 'categoryId', required: false })
    @ApiQuery({ name: 'sort', required: false, enum: ['oldest', 'newest', 'priceHigh', 'priceLow'] })
    @ApiQuery({ name: 'q', required: false, description: 'Search gig title or seller display name' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'pageSize', required: false, example: 20 })
    @ApiResponse({ status: 200, type: AdminGigQueueResponseDto })
    @ApiResponse({ status: 403, description: 'Admin only' })
    async listQueue(
        @Query('status') status?: string,
        @Query('categoryId') categoryId?: string,
        @Query('sort') sort?: string,
        @Query('q') q?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string
    ): Promise<ServiceResponse<AdminGigQueueResponseDto>> {
        const result: ListAdminGigQueueResult = await this.queryBus.execute(
            new ListAdminGigQueueQuery(
                (status as AdminQueueStatusFilter) ?? 'pending',
                (sort as AdminQueueSort) ?? 'oldest',
                Number.parseInt(page ?? '1', 10) || 1,
                Number.parseInt(pageSize ?? '20', 10) || 20,
                categoryId,
                q
            )
        )

        const items: AdminQueueRowDto[] = await Promise.all(result.items.map((row) => this.toRowDto(row)))

        const dto = validateAndTransform(AdminGigQueueResponseDto, {
            items,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            counts: validateAndTransform(AdminQueueCountsDto, result.counts)
        })

        return createResponse(
            RESPONSE_CODES.ADMIN_GIG_QUEUE_FETCH_SUCCESS,
            RESPONSE_TYPES.ADMIN_GIG_QUEUE_FETCH,
            MESSAGES.GIG.QUEUE_FETCHED,
            dto
        )
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get full gig detail for the Review Modal' })
    @ApiParam({ name: 'id', description: 'Gig UUID' })
    @ApiResponse({ status: 200, type: AdminGigDetailDto })
    @ApiResponse({ status: 404, description: 'Gig not found' })
    async getById(@Param('id') id: string): Promise<ServiceResponse<AdminGigDetailDto>> {
        const detail: AdminGigDetail = await this.queryBus.execute(new GetAdminGigByIdQuery(id))
        const dto = await this.toDetailDto(detail)
        return createResponse(
            RESPONSE_CODES.ADMIN_GIG_FETCH_SUCCESS,
            RESPONSE_TYPES.ADMIN_GIG_FETCH,
            MESSAGES.GIG.FETCHED,
            dto
        )
    }

    @Post(':id/approve')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Approve a pending gig', description: 'Pending → Active. The gig becomes browseable.' })
    @ApiParam({ name: 'id', description: 'Gig UUID' })
    @ApiResponse({ status: 200, type: AdminGigDetailDto })
    @ApiResponse({ status: 409, description: 'Gig is not pending review' })
    async approve(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('id') id: string
    ): Promise<ServiceResponse<AdminGigDetailDto>> {
        await this.commandBus.execute(new ApproveGigCommand(id, user.local.dbId))
        const detail: AdminGigDetail = await this.queryBus.execute(new GetAdminGigByIdQuery(id))
        const dto = await this.toDetailDto(detail)
        return createResponse(
            RESPONSE_CODES.ADMIN_GIG_APPROVE_SUCCESS,
            RESPONSE_TYPES.ADMIN_GIG_APPROVE,
            MESSAGES.GIG.APPROVED,
            dto
        )
    }

    @Post(':id/reject')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Reject a pending gig with feedback',
        description: 'Pending → Rejected. Persists category + reason shown to the seller.'
    })
    @ApiParam({ name: 'id', description: 'Gig UUID' })
    @ApiResponse({ status: 200, type: AdminGigDetailDto })
    @ApiResponse({ status: 400, description: 'Invalid category or reason' })
    @ApiResponse({ status: 409, description: 'Gig is not pending review' })
    async reject(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('id') id: string,
        @Body() dto: RejectGigRequestDto
    ): Promise<ServiceResponse<AdminGigDetailDto>> {
        await this.commandBus.execute(
            new RejectGigCommand(id, user.local.dbId, dto.rejectionCategory, dto.rejectionReason)
        )
        const detail: AdminGigDetail = await this.queryBus.execute(new GetAdminGigByIdQuery(id))
        const responseDto = await this.toDetailDto(detail)
        return createResponse(
            RESPONSE_CODES.ADMIN_GIG_REJECT_SUCCESS,
            RESPONSE_TYPES.ADMIN_GIG_REJECT,
            MESSAGES.GIG.REJECTED,
            responseDto
        )
    }

    // ───────────────────────────────────────────────────────────────────────
    // Helpers
    // ───────────────────────────────────────────────────────────────────────

    private async resolveKey(key: string | null): Promise<string | null> {
        if (!key) return null
        const url = await this.storage.getSignedReadUrl(key)
        return getFullUrl(url, this.configService.get<string>('app.baseUrl')) ?? url
    }

    private async toRowDto(row: AdminQueueRow): Promise<AdminQueueRowDto> {
        const [coverImageUrl, avatarUrl] = await Promise.all([
            row.coverImage ? this.resolveKey(row.coverImage.imageKey) : Promise.resolve(null),
            this.resolveKey(row.seller.avatarKey)
        ])

        const seller = validateAndTransform(AdminQueueSellerDto, {
            id: row.seller.id,
            username: row.seller.username,
            displayName: row.seller.displayName,
            avatarUrl,
            isEndorsed: row.seller.isEndorsed
        })

        return validateAndTransform(AdminQueueRowDto, {
            id: row.gig.id,
            title: row.gig.title,
            status: row.gig.status,
            priceVnd: row.gig.priceVnd,
            deliveryDays: row.gig.deliveryDays,
            coverImageUrl,
            categoryName: row.categoryName,
            isReReview: row.isReReview,
            submittedAt: row.gig.submittedAt?.toISOString() ?? null,
            seller
        })
    }

    private async toDetailDto(detail: AdminGigDetail): Promise<AdminGigDetailDto> {
        const images: GigImageDto[] = await Promise.all(
            detail.images.map(async (i) =>
                validateAndTransform(GigImageDto, {
                    id: i.id,
                    url: (await this.resolveKey(i.imageKey)) ?? '',
                    width: i.width,
                    height: i.height,
                    position: i.position
                })
            )
        )

        const bullets: GigBulletDto[] = detail.bullets.map((b) =>
            validateAndTransform(GigBulletDto, { id: b.id, text: b.text, position: b.position })
        )

        const faqs: GigFaqDto[] = detail.faqs.map((f) =>
            validateAndTransform(GigFaqDto, {
                id: f.id,
                question: f.question,
                answer: f.answer,
                position: f.position
            })
        )

        const seller = validateAndTransform(AdminGigDetailSellerDto, {
            id: detail.seller.id,
            username: detail.seller.username,
            displayName: detail.seller.displayName,
            avatarUrl: await this.resolveKey(detail.seller.avatarKey),
            isEndorsed: detail.seller.isEndorsed,
            joinedAt: detail.seller.joinedAt.toISOString()
        })

        return validateAndTransform(AdminGigDetailDto, {
            id: detail.gig.id,
            categoryId: detail.gig.categoryId,
            categoryName: detail.categoryName,
            categoryIcon: detail.categoryIcon,
            title: detail.gig.title,
            description: detail.gig.description,
            priceVnd: detail.gig.priceVnd,
            deliveryDays: detail.gig.deliveryDays,
            status: detail.gig.status,
            isReReview: detail.isReReview,
            rejectionCategory: detail.gig.rejectionCategory,
            rejectionReason: detail.gig.rejectionReason,
            createdAt: detail.gig.createdAt.toISOString(),
            submittedAt: detail.gig.submittedAt?.toISOString() ?? null,
            approvedAt: detail.gig.approvedAt?.toISOString() ?? null,
            images,
            bullets,
            faqs,
            seller
        })
    }
}
