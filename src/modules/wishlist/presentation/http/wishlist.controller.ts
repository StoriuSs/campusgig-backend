import { Controller, Post, Delete, Get, Param, Query, HttpCode, HttpStatus, Inject } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ConfigService } from '@nestjs/config'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger'

import { CurrentUser } from '@/shared/infrastructure'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform, getFullUrl } from '@/shared/utils'

import { GigStoragePort, GIG_STORAGE_PORT } from '@/modules/gigs/application/ports'
import { SaveGigCommand, UnsaveGigCommand, GetWishlistQuery } from '@/modules/wishlist/application'
import type { GetWishlistResult, WishlistGigItem } from '@/modules/wishlist/domain/ports/wishlist.repository.port'
import { WishlistResponseDto, WishlistGigItemDto, WishlistGigSellerDto } from './dto'

@ApiTags('Wishlist')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'wishlist', version: '1' })
export class WishlistController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
        private readonly configService: ConfigService,
        @Inject(GIG_STORAGE_PORT) private readonly storage: GigStoragePort
    ) {}

    @Post(':gigId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Save a gig to wishlist' })
    @ApiParam({ name: 'gigId', description: 'Gig UUID' })
    @ApiResponse({ status: 200 })
    async save(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('gigId') gigId: string
    ): Promise<ServiceResponse<null>> {
        await this.commandBus.execute(new SaveGigCommand(user.local.dbId, gigId))
        return createResponse(
            RESPONSE_CODES.WISHLIST_SAVE_SUCCESS,
            RESPONSE_TYPES.WISHLIST_SAVE,
            MESSAGES.WISHLIST.SAVED,
            null
        )
    }

    @Delete(':gigId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Remove a gig from wishlist' })
    @ApiParam({ name: 'gigId', description: 'Gig UUID' })
    @ApiResponse({ status: 200 })
    async unsave(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('gigId') gigId: string
    ): Promise<ServiceResponse<null>> {
        await this.commandBus.execute(new UnsaveGigCommand(user.local.dbId, gigId))
        return createResponse(
            RESPONSE_CODES.WISHLIST_UNSAVE_SUCCESS,
            RESPONSE_TYPES.WISHLIST_UNSAVE,
            MESSAGES.WISHLIST.UNSAVED,
            null
        )
    }

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'List saved gigs (wishlist)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'pageSize', required: false, type: Number })
    @ApiQuery({ name: 'sort', required: false, enum: ['savedAt', 'priceAsc', 'priceDesc'] })
    @ApiResponse({ status: 200, type: WishlistResponseDto })
    async list(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
        @Query('sort') sort?: string
    ): Promise<ServiceResponse<WishlistResponseDto>> {
        const parsedPage = Number.parseInt(page ?? '1', 10) || 1
        const parsedPageSize = Math.min(Number.parseInt(pageSize ?? '20', 10) || 20, 50)
        const validSort =
            sort === 'priceAsc'
                ? ('priceAsc' as const)
                : sort === 'priceDesc'
                  ? ('priceDesc' as const)
                  : ('savedAt' as const)

        const result: GetWishlistResult = await this.queryBus.execute(
            new GetWishlistQuery(user.local.dbId, parsedPage, parsedPageSize, validSort)
        )

        const items: WishlistGigItemDto[] = await Promise.all(result.items.map((item) => this.toItemDto(item)))
        const dto = validateAndTransform(WishlistResponseDto, {
            items,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize
        })

        return createResponse(
            RESPONSE_CODES.WISHLIST_FETCH_SUCCESS,
            RESPONSE_TYPES.WISHLIST_FETCH,
            MESSAGES.WISHLIST.FETCHED,
            dto
        )
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────

    private async resolveKey(key: string | null): Promise<string | null> {
        if (!key) return null
        const url = await this.storage.getSignedReadUrl(key)
        return getFullUrl(url, this.configService.get<string>('app.baseUrl')) ?? url
    }

    private async toItemDto(item: WishlistGigItem): Promise<WishlistGigItemDto> {
        const [coverImageUrl, avatarUrl] = await Promise.all([
            this.resolveKey(item.coverImageKey),
            this.resolveKey(item.seller.avatarKey)
        ])
        const seller = validateAndTransform(WishlistGigSellerDto, {
            id: item.seller.id,
            username: item.seller.username,
            displayName: item.seller.displayName,
            avatarUrl,
            isEndorsed: item.seller.isEndorsed
        })
        return validateAndTransform(WishlistGigItemDto, {
            id: item.id,
            title: item.title,
            priceVnd: item.priceVnd,
            deliveryDays: item.deliveryDays,
            coverImageUrl,
            savedAt: item.savedAt instanceof Date ? item.savedAt.toISOString() : String(item.savedAt),
            seller
        })
    }
}
