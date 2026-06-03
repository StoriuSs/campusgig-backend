import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '@/shared/infrastructure'
import { formatOrderCode } from '@/shared/utils'
import { MESSAGING_REPOSITORY_PORT, MessageItem, MessagingRepositoryPort } from '@/modules/messaging/domain/ports'
import { SocketEmitter } from '@/modules/messaging/application/events/handlers'

import {
    ManageReviewSort,
    ManageReviewStatus,
    ManageReviewTier,
    ManageReviewsResult,
    PublicReviewTier,
    ReviewItem,
    ReviewSummary,
    ReviewsRepositoryPort
} from '../../domain/ports/reviews.repository.port'
import { OrderNotCompletedException, ReviewAlreadyExistsException } from '../../domain/exceptions'

// Prisma review row + its buyer relation, as selected below.
interface RawReview {
    id: string
    orderId: string
    gigId: string
    sellerId: string
    buyerId: string
    ratingHalfStars: number
    body: string
    replyBody: string | null
    repliedAt: Date | null
    createdAt: Date
    buyer: { id: string; username: string | null; displayName: string | null; avatarUrl: string | null }
}

const BUYER_SELECT = { id: true, username: true, displayName: true, avatarUrl: true }

// Whole-star tier → ratingHalfStars range (round-half-up). null = no filter.
function publicTierRange(tier: PublicReviewTier): { gte: number; lte: number } | null {
    switch (tier) {
        case '5':
            return { gte: 9, lte: 10 }
        case '4':
            return { gte: 7, lte: 8 }
        case '3':
            return { gte: 5, lte: 6 }
        case '2':
            return { gte: 3, lte: 4 }
        case '1':
            return { gte: 2, lte: 2 }
        default:
            return null
    }
}

function manageTierRange(tier: ManageReviewTier): { gte: number; lte: number } | null {
    if (tier === '1-2') return { gte: 2, lte: 4 }
    return publicTierRange(tier as PublicReviewTier)
}

// round-half-up(halfStars / 2) → whole star 1..5.
function wholeStar(halfStars: number): number {
    return Math.round(halfStars / 2)
}

@Injectable()
export class PrismaReviewsRepository implements ReviewsRepositoryPort {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(MESSAGING_REPOSITORY_PORT)
        private readonly messagingRepo: MessagingRepositoryPort,
        // Emit AFTER the $transaction commits so a rollback can't publish a phantom pill.
        private readonly socketEmitter: SocketEmitter
    ) {}

    private toItem(r: RawReview): ReviewItem {
        return {
            id: r.id,
            orderId: r.orderId,
            gigId: r.gigId,
            sellerId: r.sellerId,
            buyerId: r.buyerId,
            ratingHalfStars: r.ratingHalfStars,
            body: r.body,
            replyBody: r.replyBody,
            repliedAt: r.repliedAt,
            createdAt: r.createdAt,
            author: {
                id: r.buyer.id,
                username: r.buyer.username,
                displayName: r.buyer.displayName,
                avatarKey: r.buyer.avatarUrl
            }
        }
    }

    private emitSystemEvent(threadId: string, message: MessageItem): void {
        this.socketEmitter.emitToThread(threadId, 'message:new', {
            threadId,
            message: {
                id: message.id,
                threadId: message.threadId,
                senderId: message.senderId,
                body: message.body,
                orderId: message.orderId,
                createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
                attachments: [],
                readByRecipient: false
            }
        })
    }

    async submitReview(input: {
        orderId: string
        buyerId: string
        ratingHalfStars: number
        body: string
    }): Promise<ReviewItem> {
        const now = new Date()
        let pendingSysEvent: { threadId: string; message: MessageItem } | null = null

        const created = await this.prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id: input.orderId },
                select: { id: true, gigId: true, sellerId: true, buyerId: true, status: true, number: true }
            })
            // Defensive: handler already verified, but the tx is the source of truth.
            if (!order || order.status !== 'Completed') throw new OrderNotCompletedException(input.orderId)

            const review = await tx.review
                .create({
                    data: {
                        orderId: order.id,
                        gigId: order.gigId,
                        sellerId: order.sellerId,
                        buyerId: input.buyerId,
                        ratingHalfStars: input.ratingHalfStars,
                        body: input.body
                    },
                    include: { buyer: { select: BUYER_SELECT } }
                })
                .catch((e: { code?: string }) => {
                    if (e?.code === 'P2002') throw new ReviewAlreadyExistsException(input.orderId)
                    throw e
                })

            const gig = await tx.gig.update({
                where: { id: order.gigId },
                data: { reviewCount: { increment: 1 }, ratingSumHalfStars: { increment: input.ratingHalfStars } }
            })
            // Keep the denormalized avg (used by Browse sort/filter) in step with the counters.
            await tx.gig.update({
                where: { id: order.gigId },
                data: { avgRating: gig.reviewCount > 0 ? gig.ratingSumHalfStars / 2 / gig.reviewCount : 0 }
            })
            await tx.user.update({
                where: { id: order.sellerId },
                data: { reviewCount: { increment: 1 }, ratingSumHalfStars: { increment: input.ratingHalfStars } }
            })

            const thread = await this.messagingRepo.createOrGetThread(order.buyerId, order.sellerId)
            const buyerName = review.buyer.displayName ?? review.buyer.username ?? 'The buyer'
            const stars = input.ratingHalfStars / 2
            const sysMsg = await this.messagingRepo.insertSystemEvent({
                threadId: thread.id,
                orderId: order.id,
                type: 'review_submitted',
                payload: {
                    text: `${buyerName} left a ${stars}★ review for order ${formatOrderCode(order.number)}`,
                    ratingHalfStars: input.ratingHalfStars
                },
                at: now,
                tx
            })
            pendingSysEvent = { threadId: thread.id, message: sysMsg }

            return review as RawReview
        })

        if (pendingSysEvent) {
            const { threadId, message } = pendingSysEvent as { threadId: string; message: MessageItem }
            this.emitSystemEvent(threadId, message)
        }

        return this.toItem(created)
    }

    async findByOrderId(orderId: string): Promise<ReviewItem | null> {
        const r = await this.prisma.review.findUnique({
            where: { orderId },
            include: { buyer: { select: BUYER_SELECT } }
        })
        return r ? this.toItem(r as RawReview) : null
    }

    async findById(reviewId: string): Promise<ReviewItem | null> {
        const r = await this.prisma.review.findUnique({
            where: { id: reviewId },
            include: { buyer: { select: BUYER_SELECT } }
        })
        return r ? this.toItem(r as RawReview) : null
    }

    async getOrderForReview(orderId: string): Promise<{ buyerId: string; status: string } | null> {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { buyerId: true, status: true }
        })
        return order ? { buyerId: order.buyerId, status: order.status } : null
    }

    async findForReply(
        reviewId: string
    ): Promise<{ id: string; sellerId: string; alreadyReplied: boolean; gigStatus: string } | null> {
        const r = await this.prisma.review.findUnique({
            where: { id: reviewId },
            select: { id: true, sellerId: true, replyBody: true, gig: { select: { status: true } } }
        })
        if (!r) return null
        return { id: r.id, sellerId: r.sellerId, alreadyReplied: r.replyBody !== null, gigStatus: r.gig.status }
    }

    async setReply(reviewId: string, body: string): Promise<ReviewItem> {
        const r = await this.prisma.review.update({
            where: { id: reviewId },
            data: { replyBody: body, repliedAt: new Date() },
            include: { buyer: { select: BUYER_SELECT } }
        })
        return this.toItem(r as RawReview)
    }

    async listForGig(input: {
        gigId: string
        tier: PublicReviewTier
        query: string | null
        skip: number
        take: number
    }): Promise<{ items: ReviewItem[]; total: number }> {
        const range = publicTierRange(input.tier)
        const where = {
            gigId: input.gigId,
            ...(range ? { ratingHalfStars: range } : {}),
            ...(input.query ? { body: { contains: input.query, mode: 'insensitive' as const } } : {})
        }
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.review.findMany({
                where,
                include: { buyer: { select: BUYER_SELECT } },
                orderBy: { createdAt: 'desc' },
                skip: input.skip,
                take: input.take
            }),
            this.prisma.review.count({ where })
        ])
        return { items: (rows as RawReview[]).map((r) => this.toItem(r)), total }
    }

    async summaryForGig(gigId: string): Promise<ReviewSummary> {
        const [agg, grouped] = await this.prisma.$transaction([
            this.prisma.review.aggregate({ where: { gigId }, _avg: { ratingHalfStars: true }, _count: true }),
            this.prisma.review.groupBy({ by: ['ratingHalfStars'], where: { gigId }, _count: true })
        ])
        const tiers = { five: 0, four: 0, three: 0, two: 0, one: 0 }
        const byStar: Record<number, keyof typeof tiers> = { 5: 'five', 4: 'four', 3: 'three', 2: 'two', 1: 'one' }
        for (const g of grouped as { ratingHalfStars: number; _count: number }[]) {
            const key = byStar[wholeStar(g.ratingHalfStars)]
            if (key) tiers[key] += g._count
        }
        const total = agg._count
        const average = agg._avg.ratingHalfStars != null ? agg._avg.ratingHalfStars / 2 : null
        return { total, average, tiers }
    }

    async getGigSellerId(gigId: string): Promise<string | null> {
        const gig = await this.prisma.gig.findUnique({ where: { id: gigId }, select: { sellerId: true } })
        return gig?.sellerId ?? null
    }

    async listForSellerGig(input: {
        gigId: string
        status: ManageReviewStatus
        tier: ManageReviewTier
        sort: ManageReviewSort
        skip: number
        take: number
    }): Promise<ManageReviewsResult> {
        const range = manageTierRange(input.tier)
        const where = {
            gigId: input.gigId,
            ...(input.status === 'answered' ? { replyBody: { not: null } } : {}),
            ...(input.status === 'unanswered' ? { replyBody: null } : {}),
            ...(range ? { ratingHalfStars: range } : {})
        }
        const orderBy =
            input.sort === 'oldest'
                ? [{ createdAt: 'asc' as const }]
                : input.sort === 'highest'
                  ? [{ ratingHalfStars: 'desc' as const }, { createdAt: 'desc' as const }]
                  : input.sort === 'lowest'
                    ? [{ ratingHalfStars: 'asc' as const }, { createdAt: 'desc' as const }]
                    : [{ createdAt: 'desc' as const }]

        const [rows, total, grouped, answeredCount, unansweredCount] = await this.prisma.$transaction([
            this.prisma.review.findMany({
                where,
                include: { buyer: { select: BUYER_SELECT } },
                orderBy,
                skip: input.skip,
                take: input.take
            }),
            this.prisma.review.count({ where }),
            // Tier + answer counts are computed over the whole gig (ignoring the
            // active filter) so the dropdown labels stay stable.
            this.prisma.review.groupBy({ by: ['ratingHalfStars'], where: { gigId: input.gigId }, _count: true }),
            this.prisma.review.count({ where: { gigId: input.gigId, replyBody: { not: null } } }),
            this.prisma.review.count({ where: { gigId: input.gigId, replyBody: null } })
        ])

        const tierCounts = { five: 0, four: 0, three: 0, oneToTwo: 0 }
        for (const g of grouped as { ratingHalfStars: number; _count: number }[]) {
            const s = wholeStar(g.ratingHalfStars)
            if (s === 5) tierCounts.five += g._count
            else if (s === 4) tierCounts.four += g._count
            else if (s === 3) tierCounts.three += g._count
            else tierCounts.oneToTwo += g._count
        }

        return {
            items: (rows as RawReview[]).map((r) => this.toItem(r)),
            total,
            answeredCount,
            unansweredCount,
            tierCounts
        }
    }
}
