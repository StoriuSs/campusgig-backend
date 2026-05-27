import { Test, TestingModule } from '@nestjs/testing'
import { EventBus } from '@nestjs/cqrs'
import { ApproveGigHandler } from './approve-gig.handler'
import { ApproveGigCommand } from './approve-gig.command'
import {
    GIG_REPOSITORY_PORT,
    GigEntity,
    GigNotFoundException,
    GigNotPendingException,
    GigStatus
} from '@/modules/gigs/domain'
import { GigApprovedEvent } from '../../events/gig-approved.event'

function makeGig(status: GigStatus, overrides: Partial<ConstructorParameters<typeof GigEntity>[0]> = {}): GigEntity {
    return new GigEntity({
        id: 'gig-1',
        sellerId: 'seller-1',
        categoryId: 'cat-1',
        title: 'Calculus tutoring',
        description: 'x'.repeat(40),
        priceVnd: 150_000,
        deliveryDays: 3,
        status,
        ...overrides
    })
}

describe('ApproveGigHandler', () => {
    let handler: ApproveGigHandler
    let mockRepo: { findById: jest.Mock; approve: jest.Mock }
    let mockEventBus: { publish: jest.Mock }

    beforeEach(async () => {
        mockRepo = { findById: jest.fn(), approve: jest.fn() }
        mockEventBus = { publish: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ApproveGigHandler,
                { provide: GIG_REPOSITORY_PORT, useValue: mockRepo },
                { provide: EventBus, useValue: mockEventBus }
            ]
        }).compile()

        handler = module.get(ApproveGigHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('approves a Pending gig and publishes GigApprovedEvent', async () => {
        mockRepo.findById.mockResolvedValue(makeGig('Pending'))
        mockRepo.approve.mockResolvedValue(makeGig('Active'))

        const result = await handler.execute(new ApproveGigCommand('gig-1', 'admin-1'))

        expect(mockRepo.approve).toHaveBeenCalledWith('gig-1')
        expect(result.status).toBe('Active')
        expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(GigApprovedEvent))
        expect(mockEventBus.publish).toHaveBeenCalledWith(
            expect.objectContaining({ gigId: 'gig-1', sellerId: 'seller-1' })
        )
    })

    it('throws GigNotFoundException when the gig does not exist', async () => {
        mockRepo.findById.mockResolvedValue(null)
        await expect(handler.execute(new ApproveGigCommand('missing', 'admin-1'))).rejects.toThrow(GigNotFoundException)
        expect(mockRepo.approve).not.toHaveBeenCalled()
    })

    it('throws GigNotFoundException when the gig is soft-deleted', async () => {
        mockRepo.findById.mockResolvedValue(makeGig('Deleted', { deletedAt: new Date() }))
        await expect(handler.execute(new ApproveGigCommand('gig-1', 'admin-1'))).rejects.toThrow(GigNotFoundException)
    })

    it('throws GigNotPendingException when the gig is not Pending', async () => {
        mockRepo.findById.mockResolvedValue(makeGig('Active'))
        await expect(handler.execute(new ApproveGigCommand('gig-1', 'admin-1'))).rejects.toThrow(GigNotPendingException)
        expect(mockRepo.approve).not.toHaveBeenCalled()
        expect(mockEventBus.publish).not.toHaveBeenCalled()
    })
})
