import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { EventBus } from '@nestjs/cqrs'
import { RejectGigHandler } from './reject-gig.handler'
import { RejectGigCommand } from './reject-gig.command'
import {
    GIG_REPOSITORY_PORT,
    GigEntity,
    GigNotFoundException,
    GigNotPendingException,
    GigStatus
} from '@/modules/gigs/domain'
import { GigRejectedEvent } from '../../events/gig-rejected.event'

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

const VALID_REASON = 'The cover image is a stock photo. Please use real screenshots of your work.'

describe('RejectGigHandler', () => {
    let handler: RejectGigHandler
    let mockRepo: { findById: jest.Mock; reject: jest.Mock }
    let mockEventBus: { publish: jest.Mock }

    beforeEach(async () => {
        mockRepo = { findById: jest.fn(), reject: jest.fn() }
        mockEventBus = { publish: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RejectGigHandler,
                { provide: GIG_REPOSITORY_PORT, useValue: mockRepo },
                { provide: EventBus, useValue: mockEventBus }
            ]
        }).compile()

        handler = module.get(RejectGigHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('rejects a Pending gig and publishes GigRejectedEvent', async () => {
        mockRepo.findById.mockResolvedValue(makeGig('Pending'))
        mockRepo.reject.mockResolvedValue(
            makeGig('Rejected', { rejectionCategory: 'Image quality', rejectionReason: VALID_REASON })
        )

        const result = await handler.execute(new RejectGigCommand('gig-1', 'admin-1', 'Image quality', VALID_REASON))

        expect(mockRepo.reject).toHaveBeenCalledWith('gig-1', 'Image quality', VALID_REASON)
        expect(result.status).toBe('Rejected')
        expect(mockEventBus.publish).toHaveBeenCalledWith(
            expect.objectContaining({ gigId: 'gig-1', sellerId: 'seller-1', rejectionCategory: 'Image quality' })
        )
        expect(mockEventBus.publish).toHaveBeenCalledWith(expect.any(GigRejectedEvent))
    })

    it('trims the reason before persisting', async () => {
        mockRepo.findById.mockResolvedValue(makeGig('Pending'))
        mockRepo.reject.mockResolvedValue(makeGig('Rejected'))

        await handler.execute(new RejectGigCommand('gig-1', 'admin-1', 'Other', `  ${VALID_REASON}  `))

        expect(mockRepo.reject).toHaveBeenCalledWith('gig-1', 'Other', VALID_REASON)
    })

    it('throws BadRequestException for an invalid rejection category', async () => {
        await expect(
            handler.execute(new RejectGigCommand('gig-1', 'admin-1', 'NotACategory', VALID_REASON))
        ).rejects.toThrow(BadRequestException)
        expect(mockRepo.findById).not.toHaveBeenCalled()
    })

    it('throws BadRequestException when the reason is shorter than 20 chars', async () => {
        await expect(handler.execute(new RejectGigCommand('gig-1', 'admin-1', 'Pricing', 'too short'))).rejects.toThrow(
            BadRequestException
        )
    })

    it('throws BadRequestException when the reason is longer than 1000 chars', async () => {
        await expect(
            handler.execute(new RejectGigCommand('gig-1', 'admin-1', 'Pricing', 'x'.repeat(1001)))
        ).rejects.toThrow(BadRequestException)
    })

    it('throws GigNotFoundException when the gig does not exist', async () => {
        mockRepo.findById.mockResolvedValue(null)
        await expect(
            handler.execute(new RejectGigCommand('missing', 'admin-1', 'Pricing', VALID_REASON))
        ).rejects.toThrow(GigNotFoundException)
    })

    it('throws GigNotPendingException when the gig is not Pending', async () => {
        mockRepo.findById.mockResolvedValue(makeGig('Active'))
        await expect(
            handler.execute(new RejectGigCommand('gig-1', 'admin-1', 'Pricing', VALID_REASON))
        ).rejects.toThrow(GigNotPendingException)
        expect(mockRepo.reject).not.toHaveBeenCalled()
        expect(mockEventBus.publish).not.toHaveBeenCalled()
    })
})
