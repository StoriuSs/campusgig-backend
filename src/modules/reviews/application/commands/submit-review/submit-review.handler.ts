import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import {
    REVIEWS_REPOSITORY_PORT,
    ReviewItem,
    ReviewsRepositoryPort
} from '../../../domain/ports/reviews.repository.port'
import {
    NotTheBuyerException,
    OrderNotCompletedException,
    ReviewAlreadyExistsException
} from '../../../domain/exceptions'
import { ReviewSubmittedEvent } from '../../../domain/events'
import { SubmitReviewCommand } from './submit-review.command'

@CommandHandler(SubmitReviewCommand)
export class SubmitReviewHandler implements ICommandHandler<SubmitReviewCommand> {
    constructor(
        @Inject(REVIEWS_REPOSITORY_PORT)
        private readonly repo: ReviewsRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: SubmitReviewCommand): Promise<ReviewItem> {
        const order = await this.repo.getOrderForReview(command.orderId)
        if (!order || order.status !== 'Completed') throw new OrderNotCompletedException(command.orderId)
        if (order.buyerId !== command.viewerId) throw new NotTheBuyerException(command.orderId)

        const existing = await this.repo.findByOrderId(command.orderId)
        if (existing) throw new ReviewAlreadyExistsException(command.orderId)

        const review = await this.repo.submitReview({
            orderId: command.orderId,
            buyerId: command.viewerId,
            ratingHalfStars: command.ratingHalfStars,
            body: command.body
        })

        this.eventBus.publish(
            new ReviewSubmittedEvent(
                review.id,
                review.orderId,
                review.gigId,
                review.sellerId,
                review.buyerId,
                review.ratingHalfStars
            )
        )
        return review
    }
}
