import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'

import { REVIEWS_REPOSITORY_PORT, ManageReviewsResult } from '../../../domain/ports/reviews.repository.port'
import { ListSellerGigReviewsHandler } from './list-seller-gig-reviews.handler'
import { ListSellerGigReviewsQuery } from './list-seller-gig-reviews.query'

const SELLER = 'seller-1'
const GIG = 'gig-1'

const result: ManageReviewsResult = {
    items: [],
    total: 0,
    answeredCount: 0,
    unansweredCount: 0,
    tierCounts: { five: 0, four: 0, three: 0, oneToTwo: 0 }
}

describe('ListSellerGigReviewsHandler', () => {
    let handler: ListSellerGigReviewsHandler
    let repo: { getGigSellerId: jest.Mock; listForSellerGig: jest.Mock }

    beforeEach(async () => {
        repo = { getGigSellerId: jest.fn(), listForSellerGig: jest.fn() }
        const moduleRef: TestingModule = await Test.createTestingModule({
            providers: [ListSellerGigReviewsHandler, { provide: REVIEWS_REPOSITORY_PORT, useValue: repo }]
        }).compile()
        handler = moduleRef.get(ListSellerGigReviewsHandler)
    })

    afterEach(() => jest.clearAllMocks())

    const q = (sort: 'newest' | 'oldest' | 'highest' | 'lowest' = 'newest') =>
        new ListSellerGigReviewsQuery(SELLER, GIG, 'unanswered', '1-2', sort, 1, 8)

    it('returns reviews for the owner with the right filter args', async () => {
        repo.getGigSellerId.mockResolvedValue(SELLER)
        repo.listForSellerGig.mockResolvedValue(result)

        const out = await handler.execute(q())

        expect(repo.listForSellerGig).toHaveBeenCalledWith({
            gigId: GIG,
            status: 'unanswered',
            tier: '1-2',
            sort: 'newest',
            skip: 0,
            take: 8
        })
        expect(out).toBe(result)
    })

    it('throws NotFound when the gig is missing', async () => {
        repo.getGigSellerId.mockResolvedValue(null)
        await expect(handler.execute(q())).rejects.toThrow(NotFoundException)
        expect(repo.listForSellerGig).not.toHaveBeenCalled()
    })

    it('throws Forbidden when the viewer is not the gig owner', async () => {
        repo.getGigSellerId.mockResolvedValue('another-seller')
        await expect(handler.execute(q())).rejects.toThrow(ForbiddenException)
        expect(repo.listForSellerGig).not.toHaveBeenCalled()
    })
})
