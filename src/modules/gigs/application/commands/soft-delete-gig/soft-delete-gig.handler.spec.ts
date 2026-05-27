import { Test, TestingModule } from '@nestjs/testing'
import { SoftDeleteGigHandler } from './soft-delete-gig.handler'
import { SoftDeleteGigCommand } from './soft-delete-gig.command'
import {
    GIG_REPOSITORY_PORT,
    GigEntity,
    GigStatus,
    GigNotFoundException,
    GigLockedForReviewException
} from '@/modules/gigs/domain'

describe('SoftDeleteGigHandler', () => {
    let handler: SoftDeleteGigHandler
    let mockRepo: { findById: jest.Mock; softDelete: jest.Mock }

    const makeGig = (status: GigStatus, sellerId = 'u1') =>
        new GigEntity({
            id: 'g1',
            sellerId,
            categoryId: 'c1',
            title: 'A reasonable title',
            description: 'x'.repeat(150),
            priceVnd: 150_000,
            deliveryDays: 3,
            status,
            deletedAt: status === 'Deleted' ? new Date() : null
        })

    beforeEach(async () => {
        mockRepo = {
            findById: jest.fn(),
            softDelete: jest.fn().mockResolvedValue(undefined)
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [SoftDeleteGigHandler, { provide: GIG_REPOSITORY_PORT, useValue: mockRepo }]
        }).compile()

        handler = module.get<SoftDeleteGigHandler>(SoftDeleteGigHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it.each(['Active', 'Paused', 'Rejected'] as const)('soft-deletes a %s gig', async (status) => {
        mockRepo.findById.mockResolvedValue(makeGig(status))
        await handler.execute(new SoftDeleteGigCommand('g1', 'u1'))
        expect(mockRepo.softDelete).toHaveBeenCalledWith('g1', 'u1')
    })

    it('rejects deleting a Pending gig (locked for review)', async () => {
        mockRepo.findById.mockResolvedValue(makeGig('Pending'))
        await expect(handler.execute(new SoftDeleteGigCommand('g1', 'u1'))).rejects.toThrow(GigLockedForReviewException)
        expect(mockRepo.softDelete).not.toHaveBeenCalled()
    })

    it('is idempotent on an already-Deleted gig (no-op)', async () => {
        mockRepo.findById.mockResolvedValue(makeGig('Deleted'))
        await handler.execute(new SoftDeleteGigCommand('g1', 'u1'))
        expect(mockRepo.softDelete).not.toHaveBeenCalled()
    })

    it('throws 404 when not owned', async () => {
        mockRepo.findById.mockResolvedValue(makeGig('Active', 'other-user'))
        await expect(handler.execute(new SoftDeleteGigCommand('g1', 'u1'))).rejects.toThrow(GigNotFoundException)
    })

    it('throws 404 when not found', async () => {
        mockRepo.findById.mockResolvedValue(null)
        await expect(handler.execute(new SoftDeleteGigCommand('g1', 'u1'))).rejects.toThrow(GigNotFoundException)
    })
})
