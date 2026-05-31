import { Test, TestingModule } from '@nestjs/testing'
import { EventBus } from '@nestjs/cqrs'

import { REVIEWS_REPOSITORY_PORT, ReviewItem } from '../../../domain/ports/reviews.repository.port'
import {
    NotTheBuyerException,
    OrderNotCompletedException,
    ReviewAlreadyExistsException
} from '../../../domain/exceptions'
import { ReviewSubmittedEvent } from '../../../domain/events'
import { SubmitReviewHandler } from './submit-review.handler'
import { SubmitReviewCommand } from './submit-review.command'

const BUYER = 'buyer-1'
const ORDER = 'order-1'

const reviewItem: ReviewItem = {
    id: 'rev-1',
    orderId: ORDER,
    gigId: 'gig-1',
    sellerId: 'seller-1',
    buyerId: BUYER,
    ratingHalfStars: 9,
    body: 'Great work, very thorough.',
    replyBody: null,
    repliedAt: null,
    createdAt: new Date(),
    author: { id: BUYER, username: 'linh', displayName: 'Linh', avatarKey: null }
}

describe('SubmitReviewHandler', () => {
    let handler: SubmitReviewHandler
    let repo: {
        getOrderForReview: jest.Mock
        findByOrderId: jest.Mock
        submitReview: jest.Mock
    }
    let eventBus: { publish: jest.Mock }

    beforeEach(async () => {
        repo = {
            getOrderForReview: jest.fn(),
            findByOrderId: jest.fn(),
            submitReview: jest.fn()
        }
        eventBus = { publish: jest.fn() }

        const moduleRef: TestingModule = await Test.createTestingModule({
            providers: [
                SubmitReviewHandler,
                { provide: REVIEWS_REPOSITORY_PORT, useValue: repo },
                { provide: EventBus, useValue: eventBus }
            ]
        }).compile()

        handler = moduleRef.get(SubmitReviewHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('submits a review and publishes ReviewSubmittedEvent', async () => {
        repo.getOrderForReview.mockResolvedValue({ buyerId: BUYER, status: 'Completed' })
        repo.findByOrderId.mockResolvedValue(null)
        repo.submitReview.mockResolvedValue(reviewItem)

        const result = await handler.execute(new SubmitReviewCommand(BUYER, ORDER, 9, reviewItem.body))

        expect(repo.submitReview).toHaveBeenCalledWith({
            orderId: ORDER,
            buyerId: BUYER,
            ratingHalfStars: 9,
            body: reviewItem.body
        })
        expect(eventBus.publish).toHaveBeenCalledWith(expect.any(ReviewSubmittedEvent))
        expect(result).toEqual(reviewItem)
    })

    it('rejects when the order is not Completed', async () => {
        repo.getOrderForReview.mockResolvedValue({ buyerId: BUYER, status: 'Delivered' })
        await expect(handler.execute(new SubmitReviewCommand(BUYER, ORDER, 9, reviewItem.body))).rejects.toThrow(
            OrderNotCompletedException
        )
        expect(repo.submitReview).not.toHaveBeenCalled()
    })

    it('rejects when the order does not exist', async () => {
        repo.getOrderForReview.mockResolvedValue(null)
        await expect(handler.execute(new SubmitReviewCommand(BUYER, ORDER, 9, reviewItem.body))).rejects.toThrow(
            OrderNotCompletedException
        )
    })

    it('rejects when the viewer is not the buyer', async () => {
        repo.getOrderForReview.mockResolvedValue({ buyerId: 'someone-else', status: 'Completed' })
        await expect(handler.execute(new SubmitReviewCommand(BUYER, ORDER, 9, reviewItem.body))).rejects.toThrow(
            NotTheBuyerException
        )
        expect(repo.submitReview).not.toHaveBeenCalled()
    })

    it('rejects a second review on the same order', async () => {
        repo.getOrderForReview.mockResolvedValue({ buyerId: BUYER, status: 'Completed' })
        repo.findByOrderId.mockResolvedValue(reviewItem)
        await expect(handler.execute(new SubmitReviewCommand(BUYER, ORDER, 9, reviewItem.body))).rejects.toThrow(
            ReviewAlreadyExistsException
        )
        expect(repo.submitReview).not.toHaveBeenCalled()
    })
})
