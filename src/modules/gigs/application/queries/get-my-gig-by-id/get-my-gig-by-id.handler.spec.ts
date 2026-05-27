import { Test, TestingModule } from '@nestjs/testing'
import { GetMyGigByIdHandler } from './get-my-gig-by-id.handler'
import { GetMyGigByIdQuery } from './get-my-gig-by-id.query'
import { GIG_REPOSITORY_PORT, GigEntity, GigNotFoundException } from '@/modules/gigs/domain'

describe('GetMyGigByIdHandler', () => {
    let handler: GetMyGigByIdHandler
    let mockRepo: { findByIdWithRelations: jest.Mock }

    beforeEach(async () => {
        mockRepo = { findByIdWithRelations: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [GetMyGigByIdHandler, { provide: GIG_REPOSITORY_PORT, useValue: mockRepo }]
        }).compile()

        handler = module.get<GetMyGigByIdHandler>(GetMyGigByIdHandler)
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

    const bundle = (gig: GigEntity) => ({
        gig,
        images: [],
        bullets: [],
        faqs: [],
        categoryName: 'Tutoring',
        categoryIcon: 'BookOutlined'
    })

    it('throws GigNotFoundException when the gig does not exist', async () => {
        mockRepo.findByIdWithRelations.mockResolvedValue(null)
        await expect(handler.execute(new GetMyGigByIdQuery('g1', 'u1'))).rejects.toThrow(GigNotFoundException)
    })

    it('throws GigNotFoundException when the caller does not own the gig', async () => {
        mockRepo.findByIdWithRelations.mockResolvedValue(bundle(makeGig()))
        await expect(handler.execute(new GetMyGigByIdQuery('g1', 'other'))).rejects.toThrow(GigNotFoundException)
    })

    it('throws GigNotFoundException when the gig is soft-deleted', async () => {
        mockRepo.findByIdWithRelations.mockResolvedValue(bundle(makeGig({ deletedAt: new Date(), status: 'Deleted' })))
        await expect(handler.execute(new GetMyGigByIdQuery('g1', 'u1'))).rejects.toThrow(GigNotFoundException)
    })

    it('returns the bundle when caller owns the gig', async () => {
        const b = bundle(makeGig())
        mockRepo.findByIdWithRelations.mockResolvedValue(b)
        const result = await handler.execute(new GetMyGigByIdQuery('g1', 'u1'))
        expect(result).toBe(b)
    })
})
