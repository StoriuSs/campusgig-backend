import { Test, TestingModule } from '@nestjs/testing'
import { ListMyGigsHandler } from './list-my-gigs.handler'
import { ListMyGigsQuery } from './list-my-gigs.query'
import { GIG_REPOSITORY_PORT } from '@/modules/gigs/domain'

describe('ListMyGigsHandler', () => {
    let handler: ListMyGigsHandler
    let mockRepo: { findMine: jest.Mock; countByStatus: jest.Mock }

    beforeEach(async () => {
        mockRepo = {
            findMine: jest.fn().mockResolvedValue({ items: [], total: 0 }),
            countByStatus: jest.fn().mockResolvedValue({ all: 0, active: 0, paused: 0, pending: 0, rejected: 0 })
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [ListMyGigsHandler, { provide: GIG_REPOSITORY_PORT, useValue: mockRepo }]
        }).compile()

        handler = module.get<ListMyGigsHandler>(ListMyGigsHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('clamps page >= 1 and pageSize within bounds', async () => {
        await handler.execute(new ListMyGigsQuery('u1', 'all', 'newest', -5, 999))
        expect(mockRepo.findMine).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 100 }))
    })

    it('falls back to defaults when status / sort are invalid strings', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handler.execute(new ListMyGigsQuery('u1', 'bogus' as any, 'rubbish' as any, 1, 20))
        expect(mockRepo.findMine).toHaveBeenCalledWith(expect.objectContaining({ status: 'all', sort: 'newest' }))
    })

    it('passes through valid filters and includes counts in the result', async () => {
        const result = await handler.execute(new ListMyGigsQuery('u1', 'active', 'mostOrders', 2, 25))
        expect(mockRepo.findMine).toHaveBeenCalledWith({
            sellerId: 'u1',
            status: 'active',
            sort: 'mostOrders',
            page: 2,
            pageSize: 25
        })
        expect(result.counts).toEqual({ all: 0, active: 0, paused: 0, pending: 0, rejected: 0 })
        expect(result.page).toBe(2)
        expect(result.pageSize).toBe(25)
    })
})
