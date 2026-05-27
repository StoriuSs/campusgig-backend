import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'

import { Public } from '@/shared/infrastructure'
import { ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform } from '@/shared/utils'

import { ListAllCategoriesQuery } from '@/modules/categories/application'
import { CategoryEntity } from '@/modules/categories/domain'
import { PublicCategoryListResponseDto, PublicCategoryResponseDto } from './dto'

/**
 * Public read endpoint for categories. Used by Feature 04 Create Gig dropdown
 * and Feature 06 Browse. Cached with a 10-minute TTL — Category mutations in
 * the admin controller emit events that invalidate this cache.
 */
const CACHE_KEY = 'categories:public:all'
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

@ApiTags('Categories')
@Controller({ path: 'categories', version: '1' })
export class PublicCategoriesController {
    constructor(
        private readonly queryBus: QueryBus,
        @Inject(CACHE_MANAGER) private readonly cache: Cache
    ) {}

    @Get()
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'List all categories (public)',
        description:
            'Returns all categories alphabetically. No auth required. Cached for 10 minutes; invalidated when an admin creates, updates, or deletes a category.'
    })
    @ApiResponse({ status: 200, description: 'Categories retrieved', type: PublicCategoryListResponseDto })
    async list(): Promise<ServiceResponse<PublicCategoryListResponseDto>> {
        let items: PublicCategoryResponseDto[] | undefined

        try {
            items = (await this.cache.get<PublicCategoryResponseDto[]>(CACHE_KEY)) ?? undefined
        } catch {
            // Cache read failure shouldn't break the request — fall through to DB.
            items = undefined
        }

        if (!items) {
            const entities: CategoryEntity[] = await this.queryBus.execute(new ListAllCategoriesQuery())
            items = entities.map((e) => this.toDto(e))
            try {
                await this.cache.set(CACHE_KEY, items, CACHE_TTL_MS)
            } catch {
                // ignore cache write failure
            }
        }

        const dto = validateAndTransform(PublicCategoryListResponseDto, { items })

        return createResponse(
            RESPONSE_CODES.CATEGORIES_FETCH_SUCCESS,
            RESPONSE_TYPES.CATEGORIES_FETCH,
            MESSAGES.CATEGORY.LIST_FETCHED,
            dto
        )
    }

    private toDto(entity: CategoryEntity): PublicCategoryResponseDto {
        return validateAndTransform(PublicCategoryResponseDto, {
            id: entity.id,
            name: entity.name,
            icon: entity.icon
        })
    }
}
