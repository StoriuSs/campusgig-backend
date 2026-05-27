import { Test, TestingModule } from '@nestjs/testing'
import { ResumeGigHandler } from './resume-gig.handler'
import { ResumeGigCommand } from './resume-gig.command'
import { GIG_REPOSITORY_PORT, GigEntity, GigStatus, InvalidGigStatusTransitionException } from '@/modules/gigs/domain'

describe('ResumeGigHandler', () => {
    let handler: ResumeGigHandler
    let mockRepo: { findById: jest.Mock; resume: jest.Mock }

    const makeGig = (status: GigStatus) =>
        new GigEntity({
            id: 'g1',
            sellerId: 'u1',
            categoryId: 'c1',
            title: 'A reasonable title',
            description: 'x'.repeat(150),
            priceVnd: 150_000,
            deliveryDays: 3,
            status
        })

    beforeEach(async () => {
        mockRepo = {
            findById: jest.fn(),
            resume: jest.fn().mockImplementation(async () => makeGig('Active'))
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [ResumeGigHandler, { provide: GIG_REPOSITORY_PORT, useValue: mockRepo }]
        }).compile()

        handler = module.get<ResumeGigHandler>(ResumeGigHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('resumes a Paused gig', async () => {
        mockRepo.findById.mockResolvedValue(makeGig('Paused'))
        const result = await handler.execute(new ResumeGigCommand('g1', 'u1'))
        expect(result.status).toBe('Active')
    })

    it.each(['Pending', 'Active', 'Rejected', 'Deleted'] as const)('rejects resume from %s', async (status) => {
        mockRepo.findById.mockResolvedValue(makeGig(status))
        await expect(handler.execute(new ResumeGigCommand('g1', 'u1'))).rejects.toThrow(
            InvalidGigStatusTransitionException
        )
    })
})
