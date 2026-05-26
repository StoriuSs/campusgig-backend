import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    UseFilters
} from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger'

import { AdminOnly, CurrentUser } from '@/shared/infrastructure'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform } from '@/shared/utils'

import {
    CreateCategoryRequestDto,
    UpdateCategoryRequestDto,
    CategoryResponseDto,
    ListCategoriesResponseDto
} from './dto'
import {
    CreateCategoryCommand,
    UpdateCategoryCommand,
    DeleteCategoryCommand,
    ListCategoriesQuery
} from '@/modules/categories/application'
import { CategoryEntity, CategoryListResult } from '@/modules/categories/domain'
import { CategoriesDomainExceptionFilter } from '../filters/categories-domain-exception.filter'

@ApiTags('Admin / Categories')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'admin/categories', version: '1' })
@AdminOnly()
@UseFilters(CategoriesDomainExceptionFilter)
export class CategoriesController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus
    ) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'List categories (paginated)',
        description: 'Returns categories sorted by name ascending. gigCount and orders30d are 0 in Feature 03.'
    })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'pageSize', required: false, example: 20 })
    @ApiResponse({ status: 200, description: 'Categories retrieved', type: ListCategoriesResponseDto })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Not an admin' })
    async list(
        @Query('page') pageParam?: string,
        @Query('pageSize') pageSizeParam?: string
    ): Promise<ServiceResponse<ListCategoriesResponseDto>> {
        const page = Number.parseInt(pageParam ?? '1', 10) || 1
        const pageSize = Number.parseInt(pageSizeParam ?? '20', 10) || 20

        const result: CategoryListResult = await this.queryBus.execute(new ListCategoriesQuery(page, pageSize))

        const dto = validateAndTransform(ListCategoriesResponseDto, {
            items: result.items.map((item) => this.toCategoryDto(item.category, item.gigCount, item.orders30d)),
            total: result.total,
            page,
            pageSize
        })

        return createResponse(
            RESPONSE_CODES.CATEGORIES_FETCH_SUCCESS,
            RESPONSE_TYPES.CATEGORIES_FETCH,
            MESSAGES.CATEGORY.LIST_FETCHED,
            dto
        )
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create category', description: 'Creates a new service category.' })
    @ApiResponse({ status: 201, description: 'Created', type: CategoryResponseDto })
    @ApiResponse({ status: 400, description: 'Invalid icon or validation failed' })
    @ApiResponse({ status: 409, description: 'Name already exists (case-insensitive)' })
    async create(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Body() dto: CreateCategoryRequestDto
    ): Promise<ServiceResponse<CategoryResponseDto>> {
        const created: CategoryEntity = await this.commandBus.execute(
            new CreateCategoryCommand(dto.name, dto.icon, dto.description ?? null, user.local.dbId)
        )

        return createResponse(
            RESPONSE_CODES.CATEGORY_CREATE_SUCCESS,
            RESPONSE_TYPES.CATEGORY_CREATE,
            MESSAGES.CATEGORY.CREATED,
            this.toCategoryDto(created, 0, 0)
        )
    }

    @Patch(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Update category',
        description: 'Updates name, icon, or description. All fields optional.'
    })
    @ApiParam({ name: 'id', description: 'Category UUID' })
    @ApiResponse({ status: 200, description: 'Updated', type: CategoryResponseDto })
    @ApiResponse({ status: 404, description: 'Category not found' })
    @ApiResponse({ status: 409, description: 'Name already exists' })
    async update(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('id') id: string,
        @Body() dto: UpdateCategoryRequestDto
    ): Promise<ServiceResponse<CategoryResponseDto>> {
        const updated: CategoryEntity = await this.commandBus.execute(
            new UpdateCategoryCommand(id, dto.name, dto.icon, dto.description, user.local.dbId)
        )

        // gigCount/orders30d are not refetched here — frontend already has them
        // from the list response. Refetching would require an extra query for
        // no UX benefit in Feature 03 (always 0). Feature 04+ can revisit.
        return createResponse(
            RESPONSE_CODES.CATEGORY_UPDATE_SUCCESS,
            RESPONSE_TYPES.CATEGORY_UPDATE,
            MESSAGES.CATEGORY.UPDATED,
            this.toCategoryDto(updated, 0, 0)
        )
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Delete category',
        description:
            'Deletes a category. If the category has ≥1 gigs, `reassignTo` is required and all gigs are reassigned to that category first.'
    })
    @ApiParam({ name: 'id', description: 'Category UUID' })
    @ApiQuery({ name: 'reassignTo', required: false, description: 'Required when the category has any gigs.' })
    @ApiResponse({ status: 204, description: 'Deleted' })
    @ApiResponse({ status: 400, description: 'Reassign target invalid' })
    @ApiResponse({ status: 404, description: 'Category not found' })
    @ApiResponse({ status: 409, description: 'Category has gigs and no reassignTo provided' })
    async remove(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('id') id: string,
        @Query('reassignTo') reassignTo?: string
    ): Promise<void> {
        await this.commandBus.execute(new DeleteCategoryCommand(id, reassignTo || null, user.local.dbId))
    }

    // ────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────

    private toCategoryDto(entity: CategoryEntity, gigCount: number, orders30d: number): CategoryResponseDto {
        return validateAndTransform(CategoryResponseDto, {
            id: entity.id,
            name: entity.name,
            icon: entity.icon,
            description: entity.description,
            gigCount,
            orders30d,
            createdAt: entity.createdAt.toISOString()
        })
    }
}
