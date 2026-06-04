import { Controller, Get, HttpCode, HttpStatus, Inject } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'

import { Public, PrismaService } from '@/shared/infrastructure'
import { ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { validateAndTransform } from '@/shared/utils'

import { LandingStatsResponseDto } from './dto/landing-stats.response.dto'

/**
 * Public platform stats for the landing page trust strip. No auth. Cached 10
 * minutes — these are slow-moving aggregates, exact freshness doesn't matter.
 */
const CACHE_KEY = 'stats:landing'
const CACHE_TTL_MS = 10 * 60 * 1000

@ApiTags('Stats')
@Controller({ path: 'stats', version: '1' })
export class PublicStatsController {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(CACHE_MANAGER) private readonly cache: Cache
    ) {}

    @Get('landing')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Platform stats for the landing trust strip (public)' })
    @ApiResponse({ status: 200, type: LandingStatsResponseDto })
    async landing(): Promise<ServiceResponse<LandingStatsResponseDto>> {
        let stats: LandingStatsResponseDto | undefined
        try {
            stats = (await this.cache.get<LandingStatsResponseDto>(CACHE_KEY)) ?? undefined
        } catch {
            stats = undefined
        }

        if (!stats) {
            const [studentCount, reviewAgg] = await Promise.all([
                // Real users only — exclude admins, soft-deleted, and the platform fee-collector.
                this.prisma.user.count({
                    where: { isAdmin: false, deletedAt: null, username: { not: '__platform__' } }
                }),
                this.prisma.review.aggregate({ _avg: { ratingHalfStars: true }, _count: { _all: true } })
            ])
            const avgHalfStars = reviewAgg._avg.ratingHalfStars ?? 0
            stats = {
                studentCount,
                averageRating: Math.round((avgHalfStars / 2) * 10) / 10,
                reviewCount: reviewAgg._count._all
            }
            try {
                await this.cache.set(CACHE_KEY, stats, CACHE_TTL_MS)
            } catch {
                // ignore cache write failure
            }
        }

        const dto = validateAndTransform(LandingStatsResponseDto, stats)
        return createResponse(RESPONSE_CODES.SUCCESS, RESPONSE_TYPES.SUCCESS, MESSAGES.STATS.FETCHED, dto)
    }
}
