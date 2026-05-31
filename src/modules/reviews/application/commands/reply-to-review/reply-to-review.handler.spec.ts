import { Test, TestingModule } from '@nestjs/testing'
import { EventBus } from '@nestjs/cqrs'

import { REVIEWS_REPOSITORY_PORT, ReviewItem } from '../../../domain/ports/reviews.repository.port'
import {
    GigNotActiveForReplyException,
    NotTheSellerException,
    ReplyAlreadyExistsException,
    ReviewNotFoundException
} from '../../../domain/exceptions'
import { ReviewRepliedEvent } from '../../../domain/events'
import { ReplyToReviewHandler } from './reply-to-review.handler'
import { ReplyToReviewCommand } from './reply-to-review.command'

const SELLER = 'seller-1'
const REVIEW = 'rev-1'

const repliedItem: ReviewItem = {
    id: REVIEW,
    orderId: 'order-1',
    gigId: 'gig-1',
    sellerId: SELLER,
    buyerId: 'buyer-1',
    ratingHalfStars: 8,
    body: 'Solid delivery.',
    replyBody: 'Thanks for the kind words!',
    repliedAt: new Date(),
    createdAt: new Date(),
    author: { id: 'buyer-1', username: 'linh', displayName: 'Linh', avatarKey: null }
}

describe('ReplyToReviewHandler', () => {
    let handler: ReplyToReviewHandler
    let repo: { findForReply: jest.Mock; setReply: jest.Mock }
    let eventBus: { publish: jest.Mock }

    beforeEach(async () => {
        repo = { findForReply: jest.fn(), setReply: jest.fn() }
        eventBus = { publish: jest.fn() }
        const moduleRef: TestingModule = await Test.createTestingModule({
            providers: [
                ReplyToReviewHandler,
                { provide: REVIEWS_REPOSITORY_PORT, useValue: repo },
                { provide: EventBus, useValue: eventBus }
            ]
        }).compile()
        handler = moduleRef.get(ReplyToReviewHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('posts a reply and publishes ReviewRepliedEvent', async () => {
        repo.findForReply.mockResolvedValue({
            id: REVIEW,
            sellerId: SELLER,
            alreadyReplied: false,
            gigStatus: 'Active'
        })
        repo.setReply.mockResolvedValue(repliedItem)

        const result = await handler.execute(new ReplyToReviewCommand(SELLER, REVIEW, repliedItem.replyBody!))

        expect(repo.setReply).toHaveBeenCalledWith(REVIEW, repliedItem.replyBody)
        expect(eventBus.publish).toHaveBeenCalledWith(expect.any(ReviewRepliedEvent))
        expect(result).toEqual(repliedItem)
    })

    it('rejects when the review does not exist', async () => {
        repo.findForReply.mockResolvedValue(null)
        await expect(handler.execute(new ReplyToReviewCommand(SELLER, REVIEW, 'hi'))).rejects.toThrow(
            ReviewNotFoundException
        )
    })

    it('rejects when the viewer is not the seller', async () => {
        repo.findForReply.mockResolvedValue({
            id: REVIEW,
            sellerId: 'other',
            alreadyReplied: false,
            gigStatus: 'Active'
        })
        await expect(handler.execute(new ReplyToReviewCommand(SELLER, REVIEW, 'hi'))).rejects.toThrow(
            NotTheSellerException
        )
        expect(repo.setReply).not.toHaveBeenCalled()
    })

    it('rejects a second reply', async () => {
        repo.findForReply.mockResolvedValue({ id: REVIEW, sellerId: SELLER, alreadyReplied: true, gigStatus: 'Active' })
        await expect(handler.execute(new ReplyToReviewCommand(SELLER, REVIEW, 'hi'))).rejects.toThrow(
            ReplyAlreadyExistsException
        )
    })

    it('rejects when the gig is not Active', async () => {
        repo.findForReply.mockResolvedValue({
            id: REVIEW,
            sellerId: SELLER,
            alreadyReplied: false,
            gigStatus: 'Paused'
        })
        await expect(handler.execute(new ReplyToReviewCommand(SELLER, REVIEW, 'hi'))).rejects.toThrow(
            GigNotActiveForReplyException
        )
        expect(repo.setReply).not.toHaveBeenCalled()
    })
})
