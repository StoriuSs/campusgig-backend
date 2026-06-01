import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { EventBus } from '@nestjs/cqrs'
import { UpdateCategoryHandler } from './update-category.handler'
import { UpdateCategoryCommand } from './update-category.command'
import {
    CATEGORY_REPOSITORY_PORT,
    CategoryEntity,
    CategoryNotFoundException,
    DuplicateCategoryNameException,
    InvalidCategoryIconException
} from '@/modules/categories/domain'
import { ADMIN_ACTIVITY_REPOSITORY_PORT } from '@/modules/admin-activity'

describe('UpdateCategoryHandler', () => {
    let handler: UpdateCategoryHandler
    let mockRepo: {
        findById: jest.Mock
        findByNameInsensitive: jest.Mock
        update: jest.Mock
    }
    let mockActivity: { log: jest.Mock }

    const existing = new CategoryEntity({
        id: 'cat-1',
        name: 'Tutoring',
        icon: 'BookOutlined',
        description: 'old description'
    })

    beforeEach(async () => {
        mockRepo = {
            findById: jest.fn(),
            findByNameInsensitive: jest.fn(),
            update: jest.fn()
        }
        mockActivity = { log: jest.fn() }

        const mockEventBus = { publish: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UpdateCategoryHandler,
                { provide: CATEGORY_REPOSITORY_PORT, useValue: mockRepo },
                { provide: ADMIN_ACTIVITY_REPOSITORY_PORT, useValue: mockActivity },
                { provide: EventBus, useValue: mockEventBus }
            ]
        }).compile()

        handler = module.get<UpdateCategoryHandler>(UpdateCategoryHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('throws CategoryNotFoundException when id does not exist', async () => {
        mockRepo.findById.mockResolvedValue(null)
        await expect(
            handler.execute(new UpdateCategoryCommand('missing', 'X', undefined, undefined, 'admin-1'))
        ).rejects.toThrow(CategoryNotFoundException)
    })

    it('updates only the provided fields', async () => {
        mockRepo.findById.mockResolvedValue(existing)
        mockRepo.update.mockImplementation((id, patch) =>
            Promise.resolve(new CategoryEntity({ ...existing, ...patch, id }))
        )

        await handler.execute(new UpdateCategoryCommand('cat-1', undefined, 'CodeOutlined', undefined, 'admin-1'))

        expect(mockRepo.update).toHaveBeenCalledWith('cat-1', { icon: 'CodeOutlined' })
        expect(mockActivity.log).toHaveBeenCalledWith(
            expect.objectContaining({ actionType: 'category_edited', targetType: 'category', targetId: 'cat-1' })
        )
    })

    it('skips uniqueness check when the new name has the same lowercase form', async () => {
        mockRepo.findById.mockResolvedValue(existing)
        mockRepo.update.mockResolvedValue(existing)

        await handler.execute(new UpdateCategoryCommand('cat-1', 'tutoring', undefined, undefined, 'admin-1'))

        expect(mockRepo.findByNameInsensitive).not.toHaveBeenCalled()
    })

    it('rejects rename to a name owned by another category', async () => {
        mockRepo.findById.mockResolvedValue(existing)
        mockRepo.findByNameInsensitive.mockResolvedValue(
            new CategoryEntity({ id: 'cat-2', name: 'Design', icon: 'BgColorsOutlined' })
        )

        await expect(
            handler.execute(new UpdateCategoryCommand('cat-1', 'Design', undefined, undefined, 'admin-1'))
        ).rejects.toThrow(DuplicateCategoryNameException)
    })

    it('rejects invalid icons', async () => {
        mockRepo.findById.mockResolvedValue(existing)

        await expect(
            handler.execute(new UpdateCategoryCommand('cat-1', undefined, 'NotAnIcon', undefined, 'admin-1'))
        ).rejects.toThrow(InvalidCategoryIconException)
    })

    it('treats whitespace-only description as null', async () => {
        mockRepo.findById.mockResolvedValue(existing)
        mockRepo.update.mockResolvedValue(existing)

        await handler.execute(new UpdateCategoryCommand('cat-1', undefined, undefined, '   ', 'admin-1'))

        expect(mockRepo.update).toHaveBeenCalledWith('cat-1', { description: null })
    })

    it('rejects descriptions longer than 200 chars', async () => {
        mockRepo.findById.mockResolvedValue(existing)
        await expect(
            handler.execute(new UpdateCategoryCommand('cat-1', undefined, undefined, 'x'.repeat(201), 'admin-1'))
        ).rejects.toThrow(BadRequestException)
    })

    it('returns the existing entity when no fields are provided', async () => {
        mockRepo.findById.mockResolvedValue(existing)

        const result = await handler.execute(
            new UpdateCategoryCommand('cat-1', undefined, undefined, undefined, 'admin-1')
        )

        expect(result).toBe(existing)
        expect(mockRepo.update).not.toHaveBeenCalled()
    })
})
