import { Inject } from '@nestjs/common'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs'

import {
    REVIEWS_REPOSITORY_PORT,
    ReviewSummary,
    ReviewsRepositoryPort
} from '../../../domain/ports/reviews.repository.port'
import { GetGigReviewSummaryQuery } from './get-gig-review-summary.query'

@QueryHandler(GetGigReviewSummaryQuery)
export class GetGigReviewSummaryHandler implements IQueryHandler<GetGigReviewSummaryQuery> {
    constructor(
        @Inject(REVIEWS_REPOSITORY_PORT)
        private readonly repo: ReviewsRepositoryPort
    ) {}

    execute(query: GetGigReviewSummaryQuery): Promise<ReviewSummary> {
        return this.repo.summaryForGig(query.gigId)
    }
}
