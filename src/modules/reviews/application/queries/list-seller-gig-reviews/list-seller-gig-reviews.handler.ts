import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import {
    ManageReviewsResult,
    REVIEWS_REPOSITORY_PORT,
    ReviewsRepositoryPort
} from '../../../domain/ports/reviews.repository.port'
import { ListSellerGigReviewsQuery } from './list-seller-gig-reviews.query'

@QueryHandler(ListSellerGigReviewsQuery)
export class ListSellerGigReviewsHandler implements IQueryHandler<ListSellerGigReviewsQuery> {
    constructor(
        @Inject(REVIEWS_REPOSITORY_PORT)
        private readonly repo: ReviewsRepositoryPort
    ) {}

    async execute(query: ListSellerGigReviewsQuery): Promise<ManageReviewsResult> {
        const ownerId = await this.repo.getGigSellerId(query.gigId)
        if (!ownerId) throw new NotFoundException('Gig not found')
        if (ownerId !== query.viewerId) throw new ForbiddenException('Not your gig')

        return this.repo.listForSellerGig({
            gigId: query.gigId,
            status: query.status,
            tier: query.tier,
            sort: query.sort,
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize
        })
    }
}
