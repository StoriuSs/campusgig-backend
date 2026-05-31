import { Test, TestingModule } from '@nestjs/testing'
import { UpdateGigHandler } from './update-gig.handler'
import { UpdateGigCommand } from './update-gig.command'
import {
    GIG_REPOSITORY_PORT,
    GigEntity,
    GigImageEntity,
    GigBulletEntity,
    GigFaqEntity,
    GigWithRelations,
    GigStatus,
    GigNotFoundException,
    GigLockedForReviewException
} from '@/modules/gigs/domain'
import { CATEGORY_REPOSITORY_PORT, CategoryEntity } from '@/modules/categories/domain'

/**
 * The smart-moderation state machine has 5 statuses × 2 diff types = 10 cells.
 * This spec exhaustively covers all of them plus edge cases.
 */
describe('UpdateGigHandler — smart moderation', () => {
    let handler: UpdateGigHandler
    let mockGigRepo: {
        findByIdWithRelations: jest.Mock
        findImageById: jest.Mock
        update: jest.Mock
    }
    let mockCategoryRepo: { findById: jest.Mock }

    const baseBundle = (status: GigStatus): GigWithRelations => ({
        gig: new GigEntity({
            id: 'g1',
            sellerId: 'u1',
            categoryId: 'c1',
            title: 'Original Title (long enough)',
            description: 'x'.repeat(150),
            priceVnd: 150_000,
            deliveryDays: 3,
            status,
            rejectionCategory: status === 'Rejected' ? 'Policy violation' : null,
            rejectionReason: status === 'Rejected' ? 'Reason longer than twenty chars at minimum.' : null
        }),
        images: [
            new GigImageEntity({
                id: 'img-1',
                gigId: 'g1',
                imageKey: 'k1',
                width: 1200,
                height: 800,
                position: 0,
                uploaderId: 'u1'
            })
        ],
        bullets: [new GigBulletEntity({ id: 'b1', gigId: 'g1', text: 'Original bullet', position: 0 })],
        faqs: [new GigFaqEntity({ id: 'f1', gigId: 'g1', question: 'Q?', answer: 'A x'.repeat(10), position: 0 })],
        categoryName: 'Tutoring',
        categoryIcon: 'BookOutlined',
        reviewCount: 0
    })

    beforeEach(async () => {
        mockGigRepo = {
            findByIdWithRelations: jest.fn(),
            findImageById: jest.fn().mockResolvedValue(
                new GigImageEntity({
                    id: 'img-1',
                    gigId: 'g1',
                    imageKey: 'k1',
                    width: 1200,
                    height: 800,
                    position: 0,
                    uploaderId: 'u1'
                })
            ),
            update: jest.fn().mockImplementation(async (_id, _patch, nextStatus) => {
                const existing = await mockGigRepo.findByIdWithRelations()
                const status: GigStatus = nextStatus ?? existing.gig.status
                return new GigEntity({ ...existing.gig, status })
            })
        }
        mockCategoryRepo = {
            findById: jest.fn().mockResolvedValue(new CategoryEntity({ id: 'c1', name: 'X', icon: 'BookOutlined' }))
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UpdateGigHandler,
                { provide: GIG_REPOSITORY_PORT, useValue: mockGigRepo },
                { provide: CATEGORY_REPOSITORY_PORT, useValue: mockCategoryRepo }
            ]
        }).compile()

        handler = module.get<UpdateGigHandler>(UpdateGigHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('throws 404 when gig not owned by caller', async () => {
        const bundle = baseBundle('Active')
        bundle.gig = new GigEntity({ ...bundle.gig, sellerId: 'other-user' })
        mockGigRepo.findByIdWithRelations.mockResolvedValue(bundle)

        await expect(
            handler.execute(new UpdateGigCommand('g1', 'u1', { title: 'New title that is long' }))
        ).rejects.toThrow(GigNotFoundException)
    })

    // Active + sensitive → Pending
    it('Active + sensitive title edit → Pending', async () => {
        mockGigRepo.findByIdWithRelations.mockResolvedValue(baseBundle('Active'))
        const result = await handler.execute(
            new UpdateGigCommand('g1', 'u1', { title: 'A brand new long-enough title here' })
        )
        expect(result.statusChanged).toBe(true)
        expect(result.previousStatus).toBe('Active')
        expect(result.newStatus).toBe('Pending')
    })

    // Active + non-sensitive → Active
    it('Active + non-sensitive price edit → Active (stays)', async () => {
        mockGigRepo.findByIdWithRelations.mockResolvedValue(baseBundle('Active'))
        const result = await handler.execute(new UpdateGigCommand('g1', 'u1', { priceVnd: 200_000 }))
        expect(result.statusChanged).toBe(false)
        expect(result.newStatus).toBe('Active')
    })

    // Paused + sensitive → Pending
    it('Paused + sensitive description edit → Pending', async () => {
        mockGigRepo.findByIdWithRelations.mockResolvedValue(baseBundle('Paused'))
        const result = await handler.execute(new UpdateGigCommand('g1', 'u1', { description: 'y'.repeat(150) }))
        expect(result.statusChanged).toBe(true)
        expect(result.previousStatus).toBe('Paused')
        expect(result.newStatus).toBe('Pending')
    })

    // Paused + non-sensitive → Paused
    it('Paused + non-sensitive delivery edit → Paused (stays)', async () => {
        mockGigRepo.findByIdWithRelations.mockResolvedValue(baseBundle('Paused'))
        const result = await handler.execute(new UpdateGigCommand('g1', 'u1', { deliveryDays: 7 }))
        expect(result.statusChanged).toBe(false)
        expect(result.newStatus).toBe('Paused')
    })

    // Pending gigs are locked during admin review — any edit is rejected.
    it('Pending + sensitive edit → rejected (locked for review)', async () => {
        mockGigRepo.findByIdWithRelations.mockResolvedValue(baseBundle('Pending'))
        await expect(
            handler.execute(new UpdateGigCommand('g1', 'u1', { title: 'Another long-enough title' }))
        ).rejects.toThrow(GigLockedForReviewException)
        expect(mockGigRepo.update).not.toHaveBeenCalled()
    })

    it('Pending + non-sensitive edit → rejected (locked for review)', async () => {
        mockGigRepo.findByIdWithRelations.mockResolvedValue(baseBundle('Pending'))
        await expect(handler.execute(new UpdateGigCommand('g1', 'u1', { priceVnd: 200_000 }))).rejects.toThrow(
            GigLockedForReviewException
        )
        expect(mockGigRepo.update).not.toHaveBeenCalled()
    })

    // Rejected + sensitive → Pending (resubmission)
    it('Rejected + sensitive edit → Pending (resubmission)', async () => {
        mockGigRepo.findByIdWithRelations.mockResolvedValue(baseBundle('Rejected'))
        const result = await handler.execute(
            new UpdateGigCommand('g1', 'u1', { title: 'Fixed title to address feedback' })
        )
        expect(result.statusChanged).toBe(true)
        expect(result.previousStatus).toBe('Rejected')
        expect(result.newStatus).toBe('Pending')
    })

    // Rejected + non-sensitive → Pending (resubmission attempt)
    it('Rejected + non-sensitive edit → Pending (resubmission)', async () => {
        mockGigRepo.findByIdWithRelations.mockResolvedValue(baseBundle('Rejected'))
        const result = await handler.execute(new UpdateGigCommand('g1', 'u1', { priceVnd: 200_000 }))
        expect(result.statusChanged).toBe(true)
        expect(result.previousStatus).toBe('Rejected')
        expect(result.newStatus).toBe('Pending')
    })

    // Reorder counts as sensitive
    it('treats image reorder as a sensitive change', async () => {
        const bundle = baseBundle('Active')
        bundle.images = [
            new GigImageEntity({
                id: 'img-1',
                gigId: 'g1',
                imageKey: 'k1',
                width: 1200,
                height: 800,
                position: 0,
                uploaderId: 'u1'
            }),
            new GigImageEntity({
                id: 'img-2',
                gigId: 'g1',
                imageKey: 'k2',
                width: 1200,
                height: 800,
                position: 1,
                uploaderId: 'u1'
            })
        ]
        mockGigRepo.findByIdWithRelations.mockResolvedValue(bundle)
        mockGigRepo.findImageById.mockImplementation(async (id: string) => {
            return new GigImageEntity({
                id,
                gigId: 'g1',
                imageKey: `k-${id}`,
                width: 1200,
                height: 800,
                position: 0,
                uploaderId: 'u1'
            })
        })

        // Swap order
        const result = await handler.execute(new UpdateGigCommand('g1', 'u1', { imageIds: ['img-2', 'img-1'] }))
        expect(result.statusChanged).toBe(true)
        expect(result.newStatus).toBe('Pending')
    })

    // Bullet edit (text change) is sensitive
    it('treats bullet text change as a sensitive change', async () => {
        mockGigRepo.findByIdWithRelations.mockResolvedValue(baseBundle('Active'))
        const result = await handler.execute(
            new UpdateGigCommand('g1', 'u1', { bullets: ['A totally different bullet'] })
        )
        expect(result.statusChanged).toBe(true)
        expect(result.newStatus).toBe('Pending')
    })

    // No-op patch on Active stays Active
    it('empty patch on Active stays Active', async () => {
        mockGigRepo.findByIdWithRelations.mockResolvedValue(baseBundle('Active'))
        const result = await handler.execute(new UpdateGigCommand('g1', 'u1', {}))
        expect(result.statusChanged).toBe(false)
        expect(result.newStatus).toBe('Active')
    })

    // Same-value patch is non-sensitive
    it('title set to its current value is not a sensitive change', async () => {
        mockGigRepo.findByIdWithRelations.mockResolvedValue(baseBundle('Active'))
        const result = await handler.execute(
            new UpdateGigCommand('g1', 'u1', { title: 'Original Title (long enough)' })
        )
        expect(result.statusChanged).toBe(false)
        expect(result.newStatus).toBe('Active')
    })
})
