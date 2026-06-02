import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { QueryBus } from '@nestjs/cqrs'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '@/shared/infrastructure'
import { UploadService } from '@/shared/infrastructure/storage/upload.service'
import { AuthenticatedKeycloakUser, ServiceResponse, createResponse } from '@/shared/types'
import { MESSAGES, RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { getFullUrl, validateAndTransform } from '@/shared/utils'

import { DASHBOARD_PERIODS, parsePeriod } from '../../application/period.util'
import { GetSellerDashboardQuery, GetBuyerDashboardQuery } from '../../application'
import type { SellerDashboardResult, BuyerDashboardResult } from '../../application'
import { DashboardActionItem, DashboardOrderRow } from '../../domain/ports/dashboard.repository.port'
import { BuyerDashboardResponseDto, SellerDashboardResponseDto } from './dto'

@ApiTags('Dashboard')
@ApiBearerAuth('keycloak-jwt')
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly configService: ConfigService,
        private readonly uploadService: UploadService
    ) {}

    @Get('seller')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Seller dashboard (period-aware stats, charts, gig performance)' })
    @ApiQuery({ name: 'period', required: false, enum: DASHBOARD_PERIODS })
    @ApiResponse({ status: 200, type: SellerDashboardResponseDto })
    async seller(
        @CurrentUser() user: AuthenticatedKeycloakUser,
        @Query('period') period?: string
    ): Promise<ServiceResponse<SellerDashboardResponseDto>> {
        const result: SellerDashboardResult = await this.queryBus.execute(
            new GetSellerDashboardQuery(user.local.dbId, parsePeriod(period))
        )

        const [activeOrders, gigPerformance] = await Promise.all([
            this.resolveOrderRows(result.activeOrders),
            Promise.all(
                result.gigPerformance.map(async (g) => ({
                    gigId: g.gigId,
                    title: g.title,
                    coverUrl: await this.resolveKey(g.coverKey),
                    views: g.views,
                    orders: g.orders,
                    conversionPercent: g.conversionPercent,
                    earningsVnd: g.earningsVnd
                }))
            )
        ])

        const dto = validateAndTransform(SellerDashboardResponseDto, {
            statCards: result.statCards,
            earningsSeries: result.earningsSeries,
            earningsByGig: result.earningsByGig,
            activeOrders,
            gigPerformance,
            actionItems: this.toActionItems(result.actionItems),
            hasGigs: result.hasGigs,
            hasOrders: result.hasOrders
        })
        return createResponse(
            RESPONSE_CODES.DASHBOARD_SELLER_SUCCESS,
            RESPONSE_TYPES.DASHBOARD_SELLER,
            MESSAGES.DASHBOARD.SELLER,
            dto
        )
    }

    @Get('buyer')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Buyer dashboard (all-time stats, recent orders, recommendations)' })
    @ApiResponse({ status: 200, type: BuyerDashboardResponseDto })
    async buyer(@CurrentUser() user: AuthenticatedKeycloakUser): Promise<ServiceResponse<BuyerDashboardResponseDto>> {
        const result: BuyerDashboardResult = await this.queryBus.execute(new GetBuyerDashboardQuery(user.local.dbId))

        const [recentOrders, recommendations] = await Promise.all([
            this.resolveOrderRows(result.recentOrders),
            Promise.all(
                result.recommendations.map(async (g) => ({
                    gigId: g.gigId,
                    title: g.title,
                    coverUrl: await this.resolveKey(g.coverKey),
                    sellerName: g.sellerName,
                    sellerAvatarUrl: await this.resolveKey(g.sellerAvatarKey),
                    ratingAverage: g.ratingAverage,
                    reviewCount: g.reviewCount,
                    priceVnd: g.priceVnd,
                    deliveryDays: g.deliveryDays
                }))
            )
        ])

        const dto = validateAndTransform(BuyerDashboardResponseDto, {
            statCards: result.statCards,
            recentOrders,
            recommendations,
            actionItems: this.toActionItems(result.actionItems),
            hasOrders: result.hasOrders
        })
        return createResponse(
            RESPONSE_CODES.DASHBOARD_BUYER_SUCCESS,
            RESPONSE_TYPES.DASHBOARD_BUYER,
            MESSAGES.DASHBOARD.BUYER,
            dto
        )
    }

    // ── Helpers ────────────────────────────────────────────────────────────────
    private toActionItems(items: DashboardActionItem[]) {
        return items.map((i) => ({
            orderId: i.orderId,
            code: i.code,
            type: i.type,
            otherPartyName: i.otherPartyName,
            deadlineAt: i.deadlineAt
        }))
    }

    private async resolveOrderRows(rows: DashboardOrderRow[]) {
        return Promise.all(
            rows.map(async (o) => ({
                id: o.id,
                code: o.code,
                gigTitle: o.gigTitle,
                gigCoverUrl: await this.resolveKey(o.gigCoverKey),
                otherPartyName: o.otherPartyName,
                otherPartyAvatarUrl: await this.resolveKey(o.otherPartyAvatarKey),
                status: o.status,
                placedAt: o.placedAt,
                deadlineAt: o.deadlineAt,
                amountVnd: o.amountVnd
            }))
        )
    }

    private async resolveKey(key: string | null): Promise<string | null> {
        if (!key) return null
        try {
            const url = await this.uploadService.getSignedReadUrl(key)
            return getFullUrl(url, this.configService.get<string>('app.baseUrl')) ?? url
        } catch {
            return null
        }
    }
}
