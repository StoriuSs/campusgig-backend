import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import {
    REVIEWS_REPOSITORY_PORT,
    ReviewItem,
    ReviewsRepositoryPort
} from '../../../domain/ports/reviews.repository.port'
import {
    GigNotActiveForReplyException,
    NotTheSellerException,
    ReplyAlreadyExistsException,
    ReviewNotFoundException
} from '../../../domain/exceptions'
import { ReviewRepliedEvent } from '../../../domain/events'
import { ReplyToReviewCommand } from './reply-to-review.command'

@CommandHandler(ReplyToReviewCommand)
export class ReplyToReviewHandler implements ICommandHandler<ReplyToReviewCommand> {
    constructor(
        @Inject(REVIEWS_REPOSITORY_PORT)
        private readonly repo: ReviewsRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: ReplyToReviewCommand): Promise<ReviewItem> {
        const facts = await this.repo.findForReply(command.reviewId)
        if (!facts) throw new ReviewNotFoundException(command.reviewId)
        if (facts.sellerId !== command.viewerId) throw new NotTheSellerException(command.reviewId)
        if (facts.alreadyReplied) throw new ReplyAlreadyExistsException(command.reviewId)
        if (facts.gigStatus !== 'Active') throw new GigNotActiveForReplyException(command.reviewId)

        const review = await this.repo.setReply(command.reviewId, command.body)
        this.eventBus.publish(new ReviewRepliedEvent(review.id, review.gigId))
        return review
    }
}
