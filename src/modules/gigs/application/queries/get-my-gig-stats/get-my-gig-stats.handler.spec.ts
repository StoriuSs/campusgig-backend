import { Test, TestingModule } from '@nestjs/testing'
import { GetMyGigStatsHandler } from './get-my-gig-stats.handler'
import { GetMyGigStatsQuery } from './get-my-gig-stats.query'
import { GIG_REPOSITORY_PORT, GigEntity, GigNotFoundException } from '@/modules/gigs/domain'

describe('GetMyGigStatsHandler', () => {
    let handler: GetMyGigStatsHandler
    let mockRepo: { findById: jest.Mock; getStats: jest.Mock }

    beforeEach(async () => {
        mockRepo = { findById: jest.fn(), getStats: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [GetMyGigStatsHandler, { provide: GIG_REPOSITORY_PORT, useValue: mockRepo }]
        }).compile()

        handler = module.get<GetMyGigStatsHandler>(GetMyGigStatsHandler)
    })

    afterEach(() => jest.clearAllMocks())

    const makeGig = (overrides: Partial<ConstructorParameters<typeof GigEntity>[0]> = {}) =>
        new GigEntity({
            id: 'g1',
            sellerId: 'u1',
            categoryId: 'c1',
            title: 'Tutoring 101',
            description: 'x'.repeat(120),
            priceVnd: 150_000,
            deliveryDays: 3,
            status: 'Active',
            ...overrides
        })

    it('returns the period-scoped stats for the owner', async () => {
        mockRepo.findById.mockResolvedValue(makeGig())
        const stats = { views: 40, orders: 8, earningsVnd: 960_000, conversion: 0.2 }
        mockRepo.getStats.mockResolvedValue(stats)

        const result = await handler.execute(new GetMyGigStatsQuery('g1', 'u1', '30d'))

        expect(result).toBe(stats)
        expect(mockRepo.getStats).toHaveBeenCalledWith('g1', expect.objectContaining({ gte: expect.any(Date) }))
    })

    it('throws GigNotFoundException when the gig does not exist', async () => {
        mockRepo.findById.mockResolvedValue(null)
        await expect(handler.execute(new GetMyGigStatsQuery('g1', 'u1', 'thisMonth'))).rejects.toThrow(
            GigNotFoundException
        )
        expect(mockRepo.getStats).not.toHaveBeenCalled()
    })

    it('throws GigNotFoundException when another seller owns the gig', async () => {
        mockRepo.findById.mockResolvedValue(makeGig({ sellerId: 'someone-else' }))
        await expect(handler.execute(new GetMyGigStatsQuery('g1', 'u1', 'all'))).rejects.toThrow(GigNotFoundException)
        expect(mockRepo.getStats).not.toHaveBeenCalled()
    })

    it('throws GigNotFoundException for a soft-deleted gig', async () => {
        mockRepo.findById.mockResolvedValue(makeGig({ deletedAt: new Date() }))
        await expect(handler.execute(new GetMyGigStatsQuery('g1', 'u1', 'all'))).rejects.toThrow(GigNotFoundException)
    })

    it('passes an empty (unbounded) range for the "all" period', async () => {
        mockRepo.findById.mockResolvedValue(makeGig())
        mockRepo.getStats.mockResolvedValue({ views: 0, orders: 0, earningsVnd: 0, conversion: null })

        await handler.execute(new GetMyGigStatsQuery('g1', 'u1', 'all'))

        expect(mockRepo.getStats).toHaveBeenCalledWith('g1', {})
    })
})
