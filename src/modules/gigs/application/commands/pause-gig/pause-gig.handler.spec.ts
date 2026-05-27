import { Test, TestingModule } from '@nestjs/testing'
import { PauseGigHandler } from './pause-gig.handler'
import { PauseGigCommand } from './pause-gig.command'
import {
    GIG_REPOSITORY_PORT,
    GigEntity,
    GigStatus,
    GigNotFoundException,
    InvalidGigStatusTransitionException
} from '@/modules/gigs/domain'

describe('PauseGigHandler', () => {
    let handler: PauseGigHandler
    let mockRepo: { findById: jest.Mock; pause: jest.Mock }

    const makeGig = (status: GigStatus, sellerId = 'u1') =>
        new GigEntity({
            id: 'g1',
            sellerId,
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
            pause: jest.fn().mockImplementation(async () => makeGig('Paused'))
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [PauseGigHandler, { provide: GIG_REPOSITORY_PORT, useValue: mockRepo }]
        }).compile()

        handler = module.get<PauseGigHandler>(PauseGigHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('pauses an Active gig', async () => {
        mockRepo.findById.mockResolvedValue(makeGig('Active'))
        const result = await handler.execute(new PauseGigCommand('g1', 'u1'))
        expect(result.status).toBe('Paused')
    })

    it.each(['Pending', 'Paused', 'Rejected', 'Deleted'] as const)('rejects pause from %s', async (status) => {
        mockRepo.findById.mockResolvedValue(makeGig(status))
        await expect(handler.execute(new PauseGigCommand('g1', 'u1'))).rejects.toThrow(
            InvalidGigStatusTransitionException
        )
    })

    it('throws 404 when gig not owned by caller', async () => {
        mockRepo.findById.mockResolvedValue(makeGig('Active', 'other-user'))
        await expect(handler.execute(new PauseGigCommand('g1', 'u1'))).rejects.toThrow(GigNotFoundException)
    })

    it('throws 404 when gig not found', async () => {
        mockRepo.findById.mockResolvedValue(null)
        await expect(handler.execute(new PauseGigCommand('g1', 'u1'))).rejects.toThrow(GigNotFoundException)
    })
})
