import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'

import { GIG_STORAGE_PORT, GigStoragePort } from '@/modules/gigs/application/ports'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { CurrentUser, Public } from '@/shared/infrastructure'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { validateAndTransform } from '@/shared/utils'

import {
    GetGigReviewSummaryQuery,
    ListGigReviewsQuery,
    ListSellerGigReviewsQuery,
    ReplyToReviewCommand,
    SubmitReviewCommand
} from '../../application'
import {
    ManageReviewsResult,
    ReviewItem,
    ReviewSummary,
    type ManageReviewSort,
    type ManageReviewStatus,
    type ManageReviewTier,
    type PublicReviewTier
} from '../../domain/ports/reviews.repository.port'
import {
    GigReviewSummaryResponseDto,
    GigReviewsListResponseDto,
    ListGigReviewsRequestDto,
    ManageReviewsRequestDto,
    ManageReviewsResponseDto,
    ReplyToReviewRequestDto,
    ReviewResponseDto,
    SubmitReviewRequestDto
} from './dto'

const PUBLIC_PAGE_SIZE = 8
const PUBLIC_MAX_PAGE_SIZE = 20
const MANAGE_PAGE_SIZE = 8

@ApiTags('Reviews')
@Controller({ version: '1' })
export class ReviewsController {
    constructor(
        private readonly commandBus: CommandBus,
        private readonly queryBus: QueryBus,
        @Inject(GIG_STORAGE_PORT)
        private readonly imageStorage: GigStoragePort
    ) {}

    // ── Submit (buyer) ───────────────────────────────────────────────────────

    @Post('orders/:orderId/review')
    @ApiBearerAuth('keycloak-jwt')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Buyer leaves a review on a Completed order (write-once)' })
    @ApiResponse({ status: 201, type: ReviewResponseDto })
    async submitReview(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('orderId', new ParseUUIDPipe()) orderId: string,
        @Body() body: SubmitReviewRequestDto
    ): Promise<ServiceResponse<ReviewResponseDto>> {
        const ratingHalfStars = Math.max(2, Math.min(10, Math.round(body.rating * 2)))
        const review: ReviewItem = await this.commandBus.execute(
            new SubmitReviewCommand(user.local.dbId, orderId, ratingHalfStars, body.body)
        )
        const dto = await this.toReviewDto(review)
        return createResponse(
            RESPONSE_CODES.REVIEW_SUBMIT_SUCCESS,
            RESPONSE_TYPES.REVIEW_SUBMIT,
            MESSAGES.REVIEWS.SUBMITTED,
            dto
        )
    }

    // ── Reply (seller) ───────────────────────────────────────────────────────

    @Post('reviews/:reviewId/reply')
    @ApiBearerAuth('keycloak-jwt')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Seller replies to a review (write-once; gig must be Active)' })
    @ApiResponse({ status: 200, type: ReviewResponseDto })
    async replyToReview(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
        @Body() body: ReplyToReviewRequestDto
    ): Promise<ServiceResponse<ReviewResponseDto>> {
        const review: ReviewItem = await this.commandBus.execute(
            new ReplyToReviewCommand(user.local.dbId, reviewId, body.body)
        )
        const dto = await this.toReviewDto(review)
        return createResponse(
            RESPONSE_CODES.REVIEW_REPLY_SUCCESS,
            RESPONSE_TYPES.REVIEW_REPLY,
            MESSAGES.REVIEWS.REPLIED,
            dto
        )
    }

    // ── Public gig reviews + summary ─────────────────────────────────────────

    @Public()
    @Get('gigs/:gigId/reviews')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Public paginated reviews for a gig (newest first, optional tier/search)' })
    @ApiQuery({ name: 'tier', required: false })
    @ApiQuery({ name: 'q', required: false })
    @ApiResponse({ status: 200, type: GigReviewsListResponseDto })
    async listGigReviews(
        @Param('gigId', new ParseUUIDPipe()) gigId: string,
        @Query() query: ListGigReviewsRequestDto
    ): Promise<ServiceResponse<GigReviewsListResponseDto>> {
        const page = query.page ?? 1
        const pageSize = Math.min(query.pageSize ?? PUBLIC_PAGE_SIZE, PUBLIC_MAX_PAGE_SIZE)
        const result: { items: ReviewItem[]; total: number } = await this.queryBus.execute(
            new ListGigReviewsQuery(gigId, (query.tier ?? 'all') as PublicReviewTier, query.q ?? null, page, pageSize)
        )
        const items = await Promise.all(result.items.map((r) => this.toReviewDto(r)))
        const dto = { items, total: result.total, page, pageSize } as unknown as GigReviewsListResponseDto
        return createResponse(
            RESPONSE_CODES.REVIEWS_LIST_SUCCESS,
            RESPONSE_TYPES.REVIEWS_LIST,
            MESSAGES.REVIEWS.LISTED,
            dto
        )
    }

    @Public()
    @Get('gigs/:gigId/reviews/summary')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Rating breakdown (tier counts + average) for a gig' })
    @ApiResponse({ status: 200, type: GigReviewSummaryResponseDto })
    async getGigReviewSummary(
        @Param('gigId', new ParseUUIDPipe()) gigId: string
    ): Promise<ServiceResponse<GigReviewSummaryResponseDto>> {
        const summary: ReviewSummary = await this.queryBus.execute(new GetGigReviewSummaryQuery(gigId))
        const dto = validateAndTransform(GigReviewSummaryResponseDto, summary)
        return createResponse(
            RESPONSE_CODES.REVIEW_SUMMARY_SUCCESS,
            RESPONSE_TYPES.REVIEW_SUMMARY,
            MESSAGES.REVIEWS.SUMMARY_FETCHED,
            dto
        )
    }

    // ── Seller manage reviews ────────────────────────────────────────────────

    @Get('me/gigs/:gigId/reviews')
    @ApiBearerAuth('keycloak-jwt')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Seller: manage reviews for one of my gigs (filter/sort, 8/page)' })
    @ApiQuery({ name: 'status', required: false })
    @ApiQuery({ name: 'tier', required: false })
    @ApiQuery({ name: 'sort', required: false })
    @ApiResponse({ status: 200, type: ManageReviewsResponseDto })
    async listManageReviews(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Param('gigId', new ParseUUIDPipe()) gigId: string,
        @Query() query: ManageReviewsRequestDto
    ): Promise<ServiceResponse<ManageReviewsResponseDto>> {
        const page = query.page ?? 1
        const result: ManageReviewsResult = await this.queryBus.execute(
            new ListSellerGigReviewsQuery(
                user.local.dbId,
                gigId,
                (query.status ?? 'all') as ManageReviewStatus,
                (query.tier ?? 'all') as ManageReviewTier,
                (query.sort ?? 'newest') as ManageReviewSort,
                page,
                MANAGE_PAGE_SIZE
            )
        )
        const items = await Promise.all(result.items.map((r) => this.toReviewDto(r)))
        const dto = {
            items,
            total: result.total,
            page,
            pageSize: MANAGE_PAGE_SIZE,
            answeredCount: result.answeredCount,
            unansweredCount: result.unansweredCount,
            tierCounts: result.tierCounts
        } as unknown as ManageReviewsResponseDto
        return createResponse(
            RESPONSE_CODES.REVIEWS_MANAGE_LIST_SUCCESS,
            RESPONSE_TYPES.REVIEWS_MANAGE_LIST,
            MESSAGES.REVIEWS.MANAGE_LISTED,
            dto
        )
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async resolveAvatar(key: string | null): Promise<string | null> {
        if (!key) return null
        try {
            return await this.imageStorage.getSignedReadUrl(key)
        } catch {
            return null
        }
    }

    // Returns a plain object (not a class instance) so the TransformInterceptor's
    // snakecaseKeys handles nested arrays cleanly — same approach as orders list rows.
    private async toReviewDto(r: ReviewItem): Promise<ReviewResponseDto> {
        const avatarUrl = await this.resolveAvatar(r.author.avatarKey)
        return {
            id: r.id,
            gigId: r.gigId,
            rating: r.ratingHalfStars / 2,
            body: r.body,
            replyBody: r.replyBody,
            repliedAt: r.repliedAt ? r.repliedAt.toISOString() : null,
            createdAt: r.createdAt.toISOString(),
            author: {
                id: r.author.id,
                username: r.author.username,
                displayName: r.author.displayName,
                avatarUrl
            }
        } as ReviewResponseDto
    }
}
