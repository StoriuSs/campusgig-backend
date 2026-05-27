import { Test, TestingModule } from '@nestjs/testing'
import { ListAdminGigQueueHandler } from './list-admin-gig-queue.handler'
import { ListAdminGigQueueQuery } from './list-admin-gig-queue.query'
import { GIG_REPOSITORY_PORT, AdminQueueResult } from '@/modules/gigs/domain'

const EMPTY: AdminQueueResult = {
    items: [],
    total: 0,
    counts: { all: 0, firstSubmission: 0, reReview: 0 }
}

describe('ListAdminGigQueueHandler', () => {
    let handler: ListAdminGigQueueHandler
    let mockRepo: { findForAdminQueue: jest.Mock }

    beforeEach(async () => {
        mockRepo = { findForAdminQueue: jest.fn().mockResolvedValue(EMPTY) }
        const module: TestingModule = await Test.createTestingModule({
            providers: [ListAdminGigQueueHandler, { provide: GIG_REPOSITORY_PORT, useValue: mockRepo }]
        }).compile()
        handler = module.get(ListAdminGigQueueHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('passes through valid filters and echoes page/pageSize', async () => {
        const result = await handler.execute(
            new ListAdminGigQueueQuery('reReview', 'priceHigh', 2, 10, 'cat-1', 'logo')
        )

        expect(mockRepo.findForAdminQueue).toHaveBeenCalledWith({
            status: 'reReview',
            sort: 'priceHigh',
            page: 2,
            pageSize: 10,
            categoryId: 'cat-1',
            q: 'logo'
        })
        expect(result.page).toBe(2)
        expect(result.pageSize).toBe(10)
    })

    it('defaults invalid status to all and invalid sort to oldest', async () => {
        await handler.execute(new ListAdminGigQueueQuery('bogus' as never, 'bogus' as never, 1, 20))
        expect(mockRepo.findForAdminQueue).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'all', sort: 'oldest' })
        )
    })

    it('clamps page to >= 1 and pageSize to <= 100', async () => {
        await handler.execute(new ListAdminGigQueueQuery('all', 'newest', -5, 9999))
        expect(mockRepo.findForAdminQueue).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 100 }))
    })

    it('normalizes blank q and categoryId to undefined', async () => {
        await handler.execute(new ListAdminGigQueueQuery('all', 'oldest', 1, 20, '   ', '  '))
        expect(mockRepo.findForAdminQueue).toHaveBeenCalledWith(
            expect.objectContaining({ q: undefined, categoryId: undefined })
        )
    })
})
