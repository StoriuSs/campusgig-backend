import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Put,
    Body,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    UseInterceptors,
    UseFilters,
    UploadedFile,
    ParseFilePipe,
    ForbiddenException
} from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ConfigService } from '@nestjs/config'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import {
    ApiTags,
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
    ApiConsumes,
    ApiBody
} from '@nestjs/swagger'
import { Inject } from '@nestjs/common'

import { CurrentUser } from '@/shared/infrastructure'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform, getFullUrl } from '@/shared/utils'

import {
    CreateGigRequestDto,
    UpdateGigRequestDto,
    ReorderGigImagesRequestDto,
    MyGigListItemDto,
    MyGigsListResponseDto,
    MyGigsCountsDto,
    MyGigDetailDto,
    MyGigStatsDto,
    UploadGigImageResponseDto,
    UpdateGigResponseDto,
    GigImageDto,
    GigBulletDto,
    GigFaqDto
} from './dto'
import {
    ListMyGigsQuery,
    GetMyGigByIdQuery,
    GetMyGigStatsQuery,
    CreateGigCommand,
    UpdateGigCommand,
    PauseGigCommand,
    ResumeGigCommand,
    SoftDeleteGigCommand,
    UploadGigImageCommand,
    DeleteGigImageCommand,
    ReorderGigImagesCommand
} from '@/modules/gigs/application'
import type { UpdateGigResult } from '@/modules/gigs/application/commands/update-gig/update-gig.handler'
import type { UploadGigImageResult } from '@/modules/gigs/application/commands/upload-gig-image/upload-gig-image.handler'
import type { ListMyGigsResult } from '@/modules/gigs/application/queries/list-my-gigs/list-my-gigs.handler'
import {
    GigEntity,
    GigWithRelations,
    GigBulletEntity,
    GigFaqEntity,
    MyGigsStatusFilter,
    MyGigsSort,
    MyGigsListItem,
    GigStats,
    GigStatsPeriod
} from '@/modules/gigs/domain'
import { GigStoragePort, GIG_STORAGE_PORT } from '@/modules/gigs/application/ports'
import { GigsDomainExceptionFilter } from '../filters/gigs-domain-exception.filter'

@ApiTags('Gigs')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'gigs', version: '1' })
@UseFilters(GigsDomainExceptionFilter)
export class GigsController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
        private readonly configService: ConfigService,
        @Inject(GIG_STORAGE_PORT) private readonly storage: GigStoragePort
    ) {}

    // ───────────────────────────────────────────────────────────────────────
    // Reads
    // ───────────────────────────────────────────────────────────────────────

    @Get('mine')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'List my gigs',
        description: 'Paginated list of gigs owned by the authenticated buyer/seller. Excludes soft-deleted.'
    })
    @ApiQuery({ name: 'status', required: false, enum: ['all', 'active', 'paused', 'pending', 'rejected'] })
    @ApiQuery({ name: 'sort', required: false, enum: ['newest', 'oldest', 'priceHigh', 'priceLow'] })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'pageSize', required: false, example: 20 })
    @ApiResponse({ status: 200, type: MyGigsListResponseDto })
    @ApiResponse({ status: 403, description: 'Admins cannot list gigs' })
    async listMine(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Query('status') status?: string,
        @Query('sort') sort?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string
    ): Promise<ServiceResponse<MyGigsListResponseDto>> {
        this.assertNotAdmin(user)

        const result: ListMyGigsResult = await this.queryBus.execute(
            new ListMyGigsQuery(
                user.local.dbId,
                (status as MyGigsStatusFilter) ?? 'all',
                (sort as MyGigsSort) ?? 'newest',
                Number.parseInt(page ?? '1', 10) || 1,
                Number.parseInt(pageSize ?? '20', 10) || 20
            )
        )

        const items: MyGigListItemDto[] = await Promise.all(result.items.map((item) => this.toListItemDto(item)))

        const dto = validateAndTransform(MyGigsListResponseDto, {
            items,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            counts: validateAndTransform(MyGigsCountsDto, result.counts)
        })

        return createResponse(
            RESPONSE_CODES.GIGS_FETCH_SUCCESS,
            RESPONSE_TYPES.GIGS_FETCH,
            MESSAGES.GIG.LIST_FETCHED,
            dto
        )
    }

    @Get('mine/:id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get my gig by id',
        description: 'Full detail with images, bullets, FAQs, and category info.'
    })
    @ApiParam({ name: 'id', description: 'Gig UUID' })
    @ApiResponse({ status: 200, type: MyGigDetailDto })
    @ApiResponse({ status: 404, description: 'Gig not found or not owned by caller' })
    async getMyGigById(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('id') id: string
    ): Promise<ServiceResponse<MyGigDetailDto>> {
        this.assertNotAdmin(user)

        const bundle: GigWithRelations = await this.queryBus.execute(new GetMyGigByIdQuery(id, user.local.dbId))

        const dto = await this.toDetailDto(bundle)
        return createResponse(RESPONSE_CODES.GIG_FETCH_SUCCESS, RESPONSE_TYPES.GIG_FETCH, MESSAGES.GIG.FETCHED, dto)
    }

    @Get('mine/:id/stats')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get my gig performance stats',
        description: 'Period-scoped views, orders, earnings, and view→order conversion for the Manage Gig card.'
    })
    @ApiParam({ name: 'id', description: 'Gig UUID' })
    @ApiQuery({ name: 'period', required: false, enum: ['thisMonth', 'lastMonth', '7d', '30d', '90d', 'all'] })
    @ApiResponse({ status: 200, type: MyGigStatsDto })
    @ApiResponse({ status: 404, description: 'Gig not found or not owned by caller' })
    async getMyGigStats(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('id') id: string,
        @Query('period') period?: string
    ): Promise<ServiceResponse<MyGigStatsDto>> {
        this.assertNotAdmin(user)

        const stats: GigStats = await this.queryBus.execute(
            new GetMyGigStatsQuery(id, user.local.dbId, this.parsePeriod(period))
        )

        const dto = validateAndTransform(MyGigStatsDto, {
            views: stats.views,
            orders: stats.orders,
            earningsVnd: stats.earningsVnd,
            conversion: stats.conversion
        })
        return createResponse(
            RESPONSE_CODES.GIG_STATS_FETCH_SUCCESS,
            RESPONSE_TYPES.GIG_STATS_FETCH,
            MESSAGES.GIG.STATS_FETCHED,
            dto
        )
    }

    // ───────────────────────────────────────────────────────────────────────
    // Writes
    // ───────────────────────────────────────────────────────────────────────

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create gig', description: 'Submits a new gig for admin review.' })
    @ApiResponse({ status: 201, type: MyGigDetailDto })
    @ApiResponse({ status: 400, description: 'Validation failed' })
    @ApiResponse({ status: 403, description: 'Admins cannot create gigs' })
    async create(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Body() dto: CreateGigRequestDto
    ): Promise<ServiceResponse<MyGigDetailDto>> {
        this.assertNotAdmin(user)

        const created: GigEntity = await this.commandBus.execute(
            new CreateGigCommand(
                user.local.dbId,
                false, // already asserted not admin above
                dto.title,
                dto.categoryId,
                dto.description,
                dto.priceVnd,
                dto.deliveryDays,
                dto.imageIds,
                dto.bullets,
                dto.faqs
            )
        )

        // Refetch with relations to build the detail DTO consistently.
        const bundle: GigWithRelations = await this.queryBus.execute(new GetMyGigByIdQuery(created.id, user.local.dbId))
        const result = await this.toDetailDto(bundle)

        return createResponse(
            RESPONSE_CODES.GIG_CREATE_SUCCESS,
            RESPONSE_TYPES.GIG_CREATE,
            MESSAGES.GIG.CREATED,
            result
        )
    }

    @Patch(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Update gig',
        description:
            'Editing sensitive fields (title/category/description/bullets/FAQs/images) reverts the gig to Pending. Editing only price/delivery keeps the gig live.'
    })
    @ApiParam({ name: 'id', description: 'Gig UUID' })
    @ApiResponse({ status: 200, type: UpdateGigResponseDto })
    @ApiResponse({ status: 404, description: 'Gig not found or not owned' })
    async update(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('id') id: string,
        @Body() dto: UpdateGigRequestDto
    ): Promise<ServiceResponse<UpdateGigResponseDto>> {
        this.assertNotAdmin(user)

        const result: UpdateGigResult = await this.commandBus.execute(
            new UpdateGigCommand(id, user.local.dbId, { ...dto })
        )

        const bundle: GigWithRelations = await this.queryBus.execute(new GetMyGigByIdQuery(id, user.local.dbId))
        const detail = await this.toDetailDto(bundle)

        const response = validateAndTransform(UpdateGigResponseDto, {
            gig: detail,
            statusChanged: result.statusChanged,
            previousStatus: result.previousStatus,
            newStatus: result.newStatus
        })

        return createResponse(
            RESPONSE_CODES.GIG_UPDATE_SUCCESS,
            RESPONSE_TYPES.GIG_UPDATE,
            MESSAGES.GIG.UPDATED,
            response
        )
    }

    @Post(':id/pause')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Pause an Active gig' })
    @ApiParam({ name: 'id', description: 'Gig UUID' })
    @ApiResponse({ status: 200, type: MyGigDetailDto })
    @ApiResponse({ status: 409, description: 'Gig is not in Active state' })
    async pause(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('id') id: string
    ): Promise<ServiceResponse<MyGigDetailDto>> {
        this.assertNotAdmin(user)
        await this.commandBus.execute(new PauseGigCommand(id, user.local.dbId))

        const bundle: GigWithRelations = await this.queryBus.execute(new GetMyGigByIdQuery(id, user.local.dbId))
        const dto = await this.toDetailDto(bundle)
        return createResponse(RESPONSE_CODES.GIG_PAUSE_SUCCESS, RESPONSE_TYPES.GIG_PAUSE, MESSAGES.GIG.PAUSED, dto)
    }

    @Post(':id/resume')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Resume a Paused gig' })
    @ApiParam({ name: 'id', description: 'Gig UUID' })
    @ApiResponse({ status: 200, type: MyGigDetailDto })
    @ApiResponse({ status: 409, description: 'Gig is not in Paused state' })
    async resume(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('id') id: string
    ): Promise<ServiceResponse<MyGigDetailDto>> {
        this.assertNotAdmin(user)
        await this.commandBus.execute(new ResumeGigCommand(id, user.local.dbId))

        const bundle: GigWithRelations = await this.queryBus.execute(new GetMyGigByIdQuery(id, user.local.dbId))
        const dto = await this.toDetailDto(bundle)
        return createResponse(RESPONSE_CODES.GIG_RESUME_SUCCESS, RESPONSE_TYPES.GIG_RESUME, MESSAGES.GIG.RESUMED, dto)
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Soft-delete gig', description: 'Sets status=Deleted. Irreversible from the seller UI.' })
    @ApiParam({ name: 'id', description: 'Gig UUID' })
    @ApiResponse({ status: 204, description: 'Deleted' })
    async remove(@CurrentUser() user: AuthenticatedKeycloakUser, @Param('id') id: string): Promise<void> {
        this.assertNotAdmin(user)
        await this.commandBus.execute(new SoftDeleteGigCommand(id, user.local.dbId))
    }

    // ───────────────────────────────────────────────────────────────────────
    // Images
    // ───────────────────────────────────────────────────────────────────────

    @Post('images')
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
    @ApiOperation({
        summary: 'Upload a gig image (orphan)',
        description:
            'Uploads one image. Returned id is used in Create/Edit gig payload. Orphan images are reaped after 1 hour.'
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({ schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' } } } })
    @ApiResponse({ status: 201, type: UploadGigImageResponseDto })
    async uploadImage(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @UploadedFile(new ParseFilePipe({ fileIsRequired: true })) file: Express.Multer.File
    ): Promise<ServiceResponse<UploadGigImageResponseDto>> {
        this.assertNotAdmin(user)

        const result: UploadGigImageResult = await this.commandBus.execute(
            new UploadGigImageCommand(file.buffer, file.originalname, user.local.dbId)
        )

        const baseUrl = this.configService.get<string>('app.baseUrl')
        const dto = validateAndTransform(UploadGigImageResponseDto, {
            id: result.image.id,
            url: getFullUrl(result.presignedUrl, baseUrl),
            width: result.image.width,
            height: result.image.height
        })

        return createResponse(
            RESPONSE_CODES.GIG_IMAGE_UPLOAD_SUCCESS,
            RESPONSE_TYPES.GIG_IMAGE_UPLOAD,
            MESSAGES.GIG.IMAGE_UPLOADED,
            dto
        )
    }

    @Delete('images/:imageId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a gig image (orphan or attached)' })
    @ApiParam({ name: 'imageId', description: 'GigImage UUID' })
    async deleteImage(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('imageId') imageId: string
    ): Promise<void> {
        this.assertNotAdmin(user)
        await this.commandBus.execute(new DeleteGigImageCommand(imageId, user.local.dbId))
    }

    @Put(':id/images/order')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Reorder a gig's images", description: 'imageIds[0] becomes the new cover.' })
    @ApiParam({ name: 'id', description: 'Gig UUID' })
    @ApiResponse({ status: 200, type: MyGigDetailDto })
    async reorderImages(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('id') id: string,
        @Body() dto: ReorderGigImagesRequestDto
    ): Promise<ServiceResponse<MyGigDetailDto>> {
        this.assertNotAdmin(user)
        await this.commandBus.execute(new ReorderGigImagesCommand(id, user.local.dbId, dto.imageIds))
        const bundle: GigWithRelations = await this.queryBus.execute(new GetMyGigByIdQuery(id, user.local.dbId))
        const detail = await this.toDetailDto(bundle)
        return createResponse(
            RESPONSE_CODES.GIG_IMAGES_REORDER_SUCCESS,
            RESPONSE_TYPES.GIG_IMAGES_REORDER,
            MESSAGES.GIG.IMAGES_REORDERED,
            detail
        )
    }

    // ───────────────────────────────────────────────────────────────────────
    // Helpers
    // ───────────────────────────────────────────────────────────────────────

    private assertNotAdmin(user: AuthenticatedKeycloakUser): void {
        if (user.local.isAdmin) {
            throw new ForbiddenException('Admin accounts cannot use seller gig endpoints.')
        }
    }

    private parsePeriod(period?: string): GigStatsPeriod {
        const allowed: GigStatsPeriod[] = ['thisMonth', 'lastMonth', '7d', '30d', '90d', 'all']
        return allowed.includes(period as GigStatsPeriod) ? (period as GigStatsPeriod) : 'thisMonth'
    }

    private async resolveImageUrl(key: string): Promise<string> {
        const url = await this.storage.getSignedReadUrl(key)
        return getFullUrl(url, this.configService.get<string>('app.baseUrl')) ?? url
    }

    private async toListItemDto(item: MyGigsListItem): Promise<MyGigListItemDto> {
        const { gig, coverImage, categoryName } = item
        const coverUrl = coverImage ? await this.resolveImageUrl(coverImage.imageKey) : null

        return validateAndTransform(MyGigListItemDto, {
            id: gig.id,
            title: gig.title,
            status: gig.status,
            priceVnd: gig.priceVnd,
            deliveryDays: gig.deliveryDays,
            coverImageUrl: coverUrl,
            categoryName,
            createdAt: gig.createdAt.toISOString(),
            ordersCount: item.ordersCount,
            avgRating: item.avgRating,
            earningsVnd: item.earningsVnd
        })
    }

    private async toDetailDto(bundle: GigWithRelations): Promise<MyGigDetailDto> {
        const cover = bundle.images.find((i) => i.position === 0) ?? bundle.images[0] ?? null
        const coverUrl = cover ? await this.resolveImageUrl(cover.imageKey) : null

        const images: GigImageDto[] = await Promise.all(
            bundle.images.map(async (i) =>
                validateAndTransform(GigImageDto, {
                    id: i.id,
                    url: await this.resolveImageUrl(i.imageKey),
                    width: i.width,
                    height: i.height,
                    position: i.position
                })
            )
        )

        const bullets: GigBulletDto[] = bundle.bullets.map((b: GigBulletEntity) =>
            validateAndTransform(GigBulletDto, {
                id: b.id,
                text: b.text,
                position: b.position
            })
        )

        const faqs: GigFaqDto[] = bundle.faqs.map((f: GigFaqEntity) =>
            validateAndTransform(GigFaqDto, {
                id: f.id,
                question: f.question,
                answer: f.answer,
                position: f.position
            })
        )

        return validateAndTransform(MyGigDetailDto, {
            id: bundle.gig.id,
            sellerId: bundle.gig.sellerId,
            categoryId: bundle.gig.categoryId,
            categoryName: bundle.categoryName,
            categoryIcon: bundle.categoryIcon,
            title: bundle.gig.title,
            description: bundle.gig.description,
            priceVnd: bundle.gig.priceVnd,
            deliveryDays: bundle.gig.deliveryDays,
            status: bundle.gig.status,
            rejectionCategory: bundle.gig.rejectionCategory,
            rejectionReason: bundle.gig.rejectionReason,
            coverImageUrl: coverUrl,
            createdAt: bundle.gig.createdAt.toISOString(),
            submittedAt: bundle.gig.submittedAt?.toISOString() ?? null,
            approvedAt: bundle.gig.approvedAt?.toISOString() ?? null,
            pausedAt: bundle.gig.pausedAt?.toISOString() ?? null,
            images,
            bullets,
            faqs,
            reviewCount: bundle.reviewCount ?? 0
        })
    }
}
