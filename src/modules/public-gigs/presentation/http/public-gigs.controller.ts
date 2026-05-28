import { Controller, Get, Param, Query, HttpCode, HttpStatus, Inject, Req } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'
import { ConfigService } from '@nestjs/config'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger'
import { Request } from 'express'

import { Public } from '@/shared/infrastructure'
import { ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform, getFullUrl } from '@/shared/utils'
import { PrismaService } from '@/shared/infrastructure'

import { GigStoragePort, GIG_STORAGE_PORT } from '@/modules/gigs/application/ports'
import { BrowseGigsQuery, GetPublicGigByIdQuery } from '@/modules/public-gigs/application'
import type {
    BrowseGigsResult,
    PublicGigDetail,
    PublicGigSummary
} from '@/modules/public-gigs/domain/ports/public-gigs.repository.port'

import {
    BrowseGigsResponseDto,
    PublicGigDetailDto,
    PublicGigSummaryDto,
    PublicGigSellerDto,
    PublicGigDetailSellerDto,
    PublicGigImageDto,
    PublicGigBulletDto,
    PublicGigFaqDto
} from './dto'

const BROWSE_TTL = 300
const DETAIL_TTL = 300

@ApiTags('Public / Gigs')
@Controller({ path: 'gigs', version: '1' })
@Public()
export class PublicGigsController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly configService: ConfigService,
        @Inject(CACHE_MANAGER) private readonly cache: Cache,
        @Inject(GIG_STORAGE_PORT) private readonly storage: GigStoragePort,
        private readonly prisma: PrismaService
    ) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Browse public gigs with filters and search' })
    @ApiQuery({ name: 'q', required: false })
    @ApiQuery({ name: 'categoryId', required: false })
    @ApiQuery({ name: 'minPrice', required: false, type: Number })
    @ApiQuery({ name: 'maxPrice', required: false, type: Number })
    @ApiQuery({ name: 'maxDelivery', required: false, type: Number })
    @ApiQuery({ name: 'endorsedOnly', required: false, type: Boolean })
    @ApiQuery({ name: 'sellerId', required: false })
    @ApiQuery({ name: 'sort', required: false, enum: ['newest', 'rating', 'priceAsc', 'priceDesc'] })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'pageSize', required: false, type: Number })
    @ApiResponse({ status: 200, type: BrowseGigsResponseDto })
    async browse(
        @Req() req: Request,
        @Query('q') q?: string,
        @Query('categoryId') categoryId?: string,
        @Query('minPrice') minPrice?: string,
        @Query('maxPrice') maxPrice?: string,
        @Query('maxDelivery') maxDelivery?: string,
        @Query('endorsedOnly') endorsedOnly?: string,
        @Query('sellerId') sellerId?: string,
        @Query('sort') sort?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string
    ): Promise<ServiceResponse<BrowseGigsResponseDto>> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userId = (req as any).user?.local?.dbId as string | undefined

        const parsedPage = Number.parseInt(page ?? '1', 10) || 1
        const parsedPageSize = Math.min(Number.parseInt(pageSize ?? '20', 10) || 20, 50)
        const parsedMinPrice = minPrice ? Number.parseInt(minPrice, 10) : undefined
        const parsedMaxPrice = maxPrice ? Number.parseInt(maxPrice, 10) : undefined
        const parsedMaxDelivery = maxDelivery ? Number.parseInt(maxDelivery, 10) : undefined
        const parsedEndorsedOnly = endorsedOnly === 'true'

        // Cache key is anonymous — never includes userId.
        // isSaved is injected live after cache lookup so it's always fresh.
        const cacheKey = `gigs:public:browse:${JSON.stringify({
            q,
            categoryId,
            minPrice: parsedMinPrice,
            maxPrice: parsedMaxPrice,
            maxDelivery: parsedMaxDelivery,
            endorsedOnly: parsedEndorsedOnly,
            sellerId,
            sort,
            page: parsedPage,
            pageSize: parsedPageSize
        })}`

        const validSort =
            sort === 'priceAsc'
                ? ('priceAsc' as const)
                : sort === 'priceDesc'
                  ? ('priceDesc' as const)
                  : sort === 'rating'
                    ? ('rating' as const)
                    : ('newest' as const)
        const cached = await this.cache.get<BrowseGigsResult>(cacheKey)
        const result: BrowseGigsResult =
            cached ??
            (await this.queryBus.execute(
                new BrowseGigsQuery({
                    q,
                    categoryId,
                    minPrice: parsedMinPrice,
                    maxPrice: parsedMaxPrice,
                    maxDelivery: parsedMaxDelivery,
                    endorsedOnly: parsedEndorsedOnly,
                    sellerId,
                    sort: validSort,
                    page: parsedPage,
                    pageSize: parsedPageSize,
                    userId: undefined // never pass userId into the cached query
                })
            ))
        if (!cached) await this.cache.set(cacheKey, result, BROWSE_TTL)

        // Hydrate isSaved live (never from cache) so heart state is always accurate
        const savedGigIds = new Set<string>()
        if (userId && result.items.length > 0) {
            const gigIds = result.items.map((i) => i.id)
            const saved = await this.prisma.savedGig.findMany({
                where: { userId, gigId: { in: gigIds } },
                select: { gigId: true }
            })
            saved.forEach((s) => savedGigIds.add(s.gigId))
        }

        const items: PublicGigSummaryDto[] = await Promise.all(
            result.items.map((item) => this.toSummaryDto({ ...item, isSaved: savedGigIds.has(item.id) }))
        )
        const dto = validateAndTransform(BrowseGigsResponseDto, {
            items,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize
        })

        return createResponse(
            RESPONSE_CODES.PUBLIC_GIGS_BROWSE_SUCCESS,
            RESPONSE_TYPES.PUBLIC_GIGS_BROWSE,
            MESSAGES.GIG.BROWSE_FETCHED,
            dto
        )
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Get public gig detail by ID' })
    @ApiParam({ name: 'id', description: 'Gig UUID' })
    @ApiResponse({ status: 200, type: PublicGigDetailDto })
    @ApiResponse({ status: 404, description: 'Gig not found' })
    async getById(@Req() req: Request, @Param('id') id: string): Promise<ServiceResponse<PublicGigDetailDto>> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userId = (req as any).user?.local?.dbId as string | undefined

        // Cache key is anonymous — isSaved hydrated live below
        const cacheKey = `gigs:public:detail:${id}`
        const cached = await this.cache.get<PublicGigDetail>(cacheKey)
        const detail: PublicGigDetail =
            cached ?? (await this.queryBus.execute(new GetPublicGigByIdQuery(id, undefined)))
        if (!cached) await this.cache.set(cacheKey, detail, DETAIL_TTL)

        // Hydrate isSaved live
        let isSaved = false
        if (userId) {
            const saved = await this.prisma.savedGig.findUnique({
                where: { userId_gigId: { userId, gigId: id } }
            })
            isSaved = saved != null
        }

        const dto = await this.toDetailDto({ ...detail, isSaved })
        return createResponse(
            RESPONSE_CODES.PUBLIC_GIG_FETCH_SUCCESS,
            RESPONSE_TYPES.PUBLIC_GIG_FETCH,
            MESSAGES.GIG.PUBLIC_FETCHED,
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

    private async toSummaryDto(item: PublicGigSummary): Promise<PublicGigSummaryDto> {
        const [coverImageUrl, avatarUrl] = await Promise.all([
            this.resolveKey(item.coverImageKey),
            this.resolveKey(item.seller.avatarKey)
        ])
        const seller = validateAndTransform(PublicGigSellerDto, {
            id: item.seller.id,
            username: item.seller.username,
            displayName: item.seller.displayName,
            avatarUrl,
            isEndorsed: item.seller.isEndorsed
        })
        return validateAndTransform(PublicGigSummaryDto, {
            id: item.id,
            title: item.title,
            priceVnd: item.priceVnd,
            deliveryDays: item.deliveryDays,
            coverImageUrl,
            avgRating: item.avgRating,
            reviewCount: item.reviewCount,
            isSaved: item.isSaved,
            seller
        })
    }

    private async toDetailDto(detail: PublicGigDetail): Promise<PublicGigDetailDto> {
        const images: PublicGigImageDto[] = await Promise.all(
            detail.images.map(async (i) =>
                validateAndTransform(PublicGigImageDto, {
                    id: i.id,
                    url: (await this.resolveKey(i.imageKey)) ?? '',
                    width: i.width,
                    height: i.height
                })
            )
        )
        const bullets: PublicGigBulletDto[] = detail.bullets.map((b) =>
            validateAndTransform(PublicGigBulletDto, { id: b.id, text: b.text })
        )
        const faqs: PublicGigFaqDto[] = detail.faqs.map((f) =>
            validateAndTransform(PublicGigFaqDto, { id: f.id, question: f.question, answer: f.answer })
        )
        const avatarUrl = await this.resolveKey(detail.seller.avatarKey)
        const seller = validateAndTransform(PublicGigDetailSellerDto, {
            id: detail.seller.id,
            username: detail.seller.username,
            displayName: detail.seller.displayName,
            avatarUrl,
            isEndorsed: detail.seller.isEndorsed,
            bio: detail.seller.bio,
            roleLine: detail.seller.roleLine,
            location: detail.seller.location,
            languages: detail.seller.languages,
            skills: detail.seller.skills,
            joinedAt:
                detail.seller.joinedAt instanceof Date
                    ? detail.seller.joinedAt.toISOString()
                    : String(detail.seller.joinedAt),
            gigCount: detail.seller.gigCount,
            avgRating: detail.seller.avgRating,
            reviewCount: detail.seller.reviewCount,
            completedOrderCount: detail.seller.completedOrderCount
        })
        const [similarGigs, otherBySellerGigs] = await Promise.all([
            Promise.all(detail.similarGigs.map((g) => this.toSummaryDto(g))),
            Promise.all(detail.otherBySellerGigs.map((g) => this.toSummaryDto(g)))
        ])
        return validateAndTransform(PublicGigDetailDto, {
            id: detail.id,
            title: detail.title,
            description: detail.description,
            priceVnd: detail.priceVnd,
            deliveryDays: detail.deliveryDays,
            categoryId: detail.categoryId,
            categoryName: detail.categoryName,
            avgRating: detail.avgRating,
            reviewCount: detail.reviewCount,
            completedOrderCount: detail.completedOrderCount,
            isSaved: detail.isSaved,
            images,
            bullets,
            faqs,
            seller,
            similarGigs,
            otherBySellerGigs
        })
    }
}
