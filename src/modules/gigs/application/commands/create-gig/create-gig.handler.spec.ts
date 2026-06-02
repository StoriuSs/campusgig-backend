import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { EventBus } from '@nestjs/cqrs'
import { CreateGigHandler } from './create-gig.handler'
import { CreateGigCommand } from './create-gig.command'
import {
    GIG_REPOSITORY_PORT,
    GigImageEntity,
    GigEntity,
    AdminCannotCreateGigException,
    GigImageCapReachedException,
    GigBulletCapReachedException,
    GigFaqCapReachedException,
    ImageNotOwnedException,
    CategoryNotFoundForGigException
} from '@/modules/gigs/domain'
import { CATEGORY_REPOSITORY_PORT, CategoryEntity } from '@/modules/categories/domain'

describe('CreateGigHandler', () => {
    let handler: CreateGigHandler
    let mockGigRepo: { findImageById: jest.Mock; create: jest.Mock }
    let mockCategoryRepo: { findById: jest.Mock }

    const validDescription = 'x'.repeat(120)
    const validImageId = (id: string, uploaderId = 'u1', gigId: string | null = null) =>
        new GigImageEntity({
            id,
            gigId,
            imageKey: `key-${id}`,
            width: 1200,
            height: 800,
            position: 0,
            uploaderId
        })

    interface CommandOverrides {
        callerId?: string
        callerIsAdmin?: boolean
        title?: string
        categoryId?: string
        description?: string
        priceVnd?: number
        deliveryDays?: number
        imageIds?: string[]
        bullets?: string[]
        faqs?: Array<{ question: string; answer: string }>
    }

    const makeCommand = (overrides: CommandOverrides = {}) => {
        const base: Required<CommandOverrides> = {
            callerId: 'u1',
            callerIsAdmin: false,
            title: 'A reasonable gig title',
            categoryId: 'c1',
            description: validDescription,
            priceVnd: 150_000,
            deliveryDays: 3,
            imageIds: ['img-1'],
            bullets: [],
            faqs: []
        }
        const merged = { ...base, ...overrides }
        return new CreateGigCommand(
            merged.callerId,
            merged.callerIsAdmin,
            merged.title,
            merged.categoryId,
            merged.description,
            merged.priceVnd,
            merged.deliveryDays,
            merged.imageIds,
            merged.bullets,
            merged.faqs
        )
    }

    beforeEach(async () => {
        mockGigRepo = {
            findImageById: jest.fn().mockImplementation(async (id: string) => validImageId(id)),
            create: jest.fn().mockResolvedValue(
                new GigEntity({
                    id: 'gig-1',
                    sellerId: 'u1',
                    categoryId: 'c1',
                    title: 'A reasonable gig title',
                    description: validDescription,
                    priceVnd: 150_000,
                    deliveryDays: 3,
                    status: 'Pending'
                })
            )
        }
        mockCategoryRepo = {
            findById: jest
                .fn()
                .mockResolvedValue(new CategoryEntity({ id: 'c1', name: 'Tutoring', icon: 'BookOutlined' }))
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CreateGigHandler,
                { provide: GIG_REPOSITORY_PORT, useValue: mockGigRepo },
                { provide: CATEGORY_REPOSITORY_PORT, useValue: mockCategoryRepo },
                { provide: EventBus, useValue: { publish: jest.fn() } }
            ]
        }).compile()

        handler = module.get<CreateGigHandler>(CreateGigHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('rejects admin callers', async () => {
        await expect(handler.execute(makeCommand({ callerIsAdmin: true }))).rejects.toThrow(
            AdminCannotCreateGigException
        )
    })

    it('creates a gig with Pending status on the happy path', async () => {
        const result = await handler.execute(makeCommand())
        expect(mockGigRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({
                sellerId: 'u1',
                title: 'A reasonable gig title',
                categoryId: 'c1'
            }),
            'Pending'
        )
        expect(result.status).toBe('Pending')
    })

    it('rejects titles outside 10-100 chars', async () => {
        await expect(handler.execute(makeCommand({ title: 'short' }))).rejects.toThrow(BadRequestException)
        await expect(handler.execute(makeCommand({ title: 'x'.repeat(101) }))).rejects.toThrow(BadRequestException)
    })

    it('rejects descriptions outside 30-5000 chars', async () => {
        await expect(handler.execute(makeCommand({ description: 'too short' }))).rejects.toThrow(BadRequestException)
        await expect(handler.execute(makeCommand({ description: 'x'.repeat(5001) }))).rejects.toThrow(
            BadRequestException
        )
    })

    it('rejects prices outside 10k-50M VND', async () => {
        await expect(handler.execute(makeCommand({ priceVnd: 9_999 }))).rejects.toThrow(BadRequestException)
        await expect(handler.execute(makeCommand({ priceVnd: 50_000_001 }))).rejects.toThrow(BadRequestException)
        await expect(handler.execute(makeCommand({ priceVnd: 1.5 }))).rejects.toThrow(BadRequestException)
    })

    it('rejects delivery times outside 1-60 days', async () => {
        await expect(handler.execute(makeCommand({ deliveryDays: 0 }))).rejects.toThrow(BadRequestException)
        await expect(handler.execute(makeCommand({ deliveryDays: 61 }))).rejects.toThrow(BadRequestException)
    })

    it('rejects missing category', async () => {
        mockCategoryRepo.findById.mockResolvedValue(null)
        await expect(handler.execute(makeCommand())).rejects.toThrow(CategoryNotFoundForGigException)
    })

    it('requires at least 1 image', async () => {
        await expect(handler.execute(makeCommand({ imageIds: [] }))).rejects.toThrow(BadRequestException)
    })

    it('rejects more than 10 images', async () => {
        const ids = Array.from({ length: 11 }, (_, i) => `img-${i}`)
        await expect(handler.execute(makeCommand({ imageIds: ids }))).rejects.toThrow(GigImageCapReachedException)
    })

    it('rejects duplicate image ids', async () => {
        await expect(handler.execute(makeCommand({ imageIds: ['img-1', 'img-1'] }))).rejects.toThrow(
            BadRequestException
        )
    })

    it('rejects images not owned by caller', async () => {
        mockGigRepo.findImageById.mockResolvedValue(validImageId('img-1', 'other-user'))
        await expect(handler.execute(makeCommand())).rejects.toThrow(ImageNotOwnedException)
    })

    it('rejects images already attached to another gig', async () => {
        mockGigRepo.findImageById.mockResolvedValue(validImageId('img-1', 'u1', 'someone-elses-gig'))
        await expect(handler.execute(makeCommand())).rejects.toThrow(ImageNotOwnedException)
    })

    it('rejects more than 5 bullets', async () => {
        await expect(
            handler.execute(makeCommand({ bullets: ['aaaaaa', 'bbbbbb', 'cccccc', 'dddddd', 'eeeeee', 'ffffff'] }))
        ).rejects.toThrow(GigBulletCapReachedException)
    })

    it('rejects more than 5 FAQs', async () => {
        const faqs = Array.from({ length: 6 }, (_, i) => ({
            question: `Question ${i}?`,
            answer: 'x'.repeat(20)
        }))
        await expect(handler.execute(makeCommand({ faqs }))).rejects.toThrow(GigFaqCapReachedException)
    })
})
