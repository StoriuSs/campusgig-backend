import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'

import { AdminOnly, CurrentUser } from '@/shared/infrastructure'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { getFullUrl, validateAndTransform } from '@/shared/utils'

import { AdminUserDetail, AdminUserListResult, AdminUserSort } from '@/modules/users/domain'
import {
    EndorseUserCommand,
    GetAdminUserDetailQuery,
    ListAdminUsersQuery,
    RevokeEndorsementCommand,
    SaveAdminNoteCommand,
    STORAGE_PORT,
    StoragePort
} from '@/modules/users/application'

import { AdminUserDetailResponseDto, AdminUsersListResponseDto, SaveAdminNoteRequestDto } from './dto'

const PAGE_SIZE = 10
const SORTS: AdminUserSort[] = ['newest', 'oldest', 'highestRating', 'mostOrders', 'mostDisputes']

@ApiTags('Admin / Users')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'admin/users', version: '1' })
@AdminOnly()
export class AdminUsersController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
        private readonly configService: ConfigService,
        @Inject(STORAGE_PORT) private readonly storage: StoragePort
    ) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List users for admin (paginated, sortable, searchable)' })
    @ApiQuery({ name: 'sort', required: false, enum: SORTS })
    @ApiQuery({ name: 'endorsed', required: false, type: Boolean })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiResponse({ status: 200, type: AdminUsersListResponseDto })
    async list(
        @Query('sort') sort?: string,
        @Query('endorsed') endorsed?: string,
        @Query('search') search?: string,
        @Query('page') page?: string
    ): Promise<ServiceResponse<AdminUsersListResponseDto>> {
        const parsedPage = Math.max(1, Number.parseInt(page ?? '1', 10) || 1)
        const result: AdminUserListResult = await this.queryBus.execute(
            new ListAdminUsersQuery({
                sort: (SORTS.includes(sort as AdminUserSort) ? sort : 'newest') as AdminUserSort,
                endorsedOnly: endorsed === 'true' || endorsed === '1',
                search: search || undefined,
                page: parsedPage,
                pageSize: PAGE_SIZE
            })
        )

        const items = await Promise.all(
            result.items.map(async (r) => ({
                id: r.id,
                username: r.username,
                displayName: r.displayName,
                email: r.email,
                avatarUrl: await this.resolveAvatar(r.avatarKey),
                joinedAt: r.createdAt.toISOString(),
                activeGigCount: r.activeGigCount,
                completedOrderCount: r.completedOrderCount,
                reviewCount: r.reviewCount,
                avgRating: r.avgRating,
                disputesLost: r.disputesLost,
                disputesTotal: r.disputesTotal,
                endorsed: r.endorsedAt != null
            }))
        )

        const dto = validateAndTransform(AdminUsersListResponseDto, {
            items,
            total: result.total,
            page: parsedPage,
            pageSize: PAGE_SIZE,
            totalUsers: result.totalUsers,
            endorsedUsers: result.endorsedUsers
        })
        return createResponse(
            RESPONSE_CODES.ADMIN_USERS_LIST_SUCCESS,
            RESPONSE_TYPES.ADMIN_USERS_LIST,
            MESSAGES.ADMIN_USERS.LISTED,
            dto
        )
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Admin user detail (stats, top gigs, endorsement, admin note)' })
    @ApiResponse({ status: 200, type: AdminUserDetailResponseDto })
    async detail(@Param('id') id: string): Promise<ServiceResponse<AdminUserDetailResponseDto>> {
        const detail: AdminUserDetail = await this.queryBus.execute(new GetAdminUserDetailQuery(id))
        const dto = await this.toDetailDto(detail)
        return createResponse(
            RESPONSE_CODES.ADMIN_USER_DETAIL_SUCCESS,
            RESPONSE_TYPES.ADMIN_USER_DETAIL,
            MESSAGES.ADMIN_USERS.FETCHED,
            dto
        )
    }

    @Post(':id/endorse')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Endorse a user (grants the Endorsed badge)' })
    @ApiResponse({ status: 200, type: AdminUserDetailResponseDto })
    async endorse(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('id') id: string
    ): Promise<ServiceResponse<AdminUserDetailResponseDto>> {
        await this.commandBus.execute(new EndorseUserCommand(id, user.local.dbId))
        const detail: AdminUserDetail = await this.queryBus.execute(new GetAdminUserDetailQuery(id))
        const dto = await this.toDetailDto(detail)
        return createResponse(
            RESPONSE_CODES.ADMIN_USER_ENDORSE_SUCCESS,
            RESPONSE_TYPES.ADMIN_USER_ENDORSE,
            MESSAGES.ADMIN_USERS.ENDORSED,
            dto
        )
    }

    @Post(':id/revoke')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Revoke a user endorsement' })
    @ApiResponse({ status: 200, type: AdminUserDetailResponseDto })
    async revoke(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('id') id: string
    ): Promise<ServiceResponse<AdminUserDetailResponseDto>> {
        await this.commandBus.execute(new RevokeEndorsementCommand(id, user.local.dbId))
        const detail: AdminUserDetail = await this.queryBus.execute(new GetAdminUserDetailQuery(id))
        const dto = await this.toDetailDto(detail)
        return createResponse(
            RESPONSE_CODES.ADMIN_USER_REVOKE_SUCCESS,
            RESPONSE_TYPES.ADMIN_USER_REVOKE,
            MESSAGES.ADMIN_USERS.REVOKED,
            dto
        )
    }

    @Post(':id/note')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Save the per-user admin note' })
    @ApiResponse({ status: 200, type: AdminUserDetailResponseDto })
    async saveNote(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('id') id: string,
        @Body() body: SaveAdminNoteRequestDto
    ): Promise<ServiceResponse<AdminUserDetailResponseDto>> {
        await this.commandBus.execute(new SaveAdminNoteCommand(id, user.local.dbId, body.note ?? null))
        const detail: AdminUserDetail = await this.queryBus.execute(new GetAdminUserDetailQuery(id))
        const dto = await this.toDetailDto(detail)
        return createResponse(
            RESPONSE_CODES.ADMIN_USER_NOTE_SUCCESS,
            RESPONSE_TYPES.ADMIN_USER_NOTE,
            MESSAGES.ADMIN_USERS.NOTE_SAVED,
            dto
        )
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async resolveAvatar(key: string | null): Promise<string | null> {
        if (!key) return null
        try {
            const url = await this.storage.getSignedReadUrl(key)
            return getFullUrl(url, this.configService.get<string>('app.baseUrl'))
        } catch {
            return null
        }
    }

    private async toDetailDto(detail: AdminUserDetail): Promise<AdminUserDetailResponseDto> {
        return validateAndTransform(AdminUserDetailResponseDto, {
            id: detail.id,
            username: detail.username,
            displayName: detail.displayName,
            email: detail.email,
            avatarUrl: await this.resolveAvatar(detail.avatarKey),
            memberSince: detail.createdAt.toISOString(),
            endorsed: detail.endorsedAt != null,
            endorsedAt: detail.endorsedAt?.toISOString() ?? null,
            endorsedByEmail: detail.endorsedByEmail,
            adminNote: detail.adminNote,
            activeGigCount: detail.activeGigCount,
            completedOrderCount: detail.completedOrderCount,
            reviewCount: detail.reviewCount,
            avgRating: detail.avgRating,
            disputesLost: detail.disputesLost,
            disputesTotal: detail.disputesTotal,
            topGigs: detail.topGigs
        })
    }
}
