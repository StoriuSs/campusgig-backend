import { Test, TestingModule } from '@nestjs/testing'
import { EventBus } from '@nestjs/cqrs'
import { DeleteCategoryHandler } from './delete-category.handler'
import { DeleteCategoryCommand } from './delete-category.command'
import {
    CATEGORY_REPOSITORY_PORT,
    CategoryEntity,
    CategoryNotFoundException,
    CategoryHasGigsException,
    InvalidReassignTargetException
} from '@/modules/categories/domain'
import { ADMIN_ACTIVITY_REPOSITORY_PORT } from '@/modules/admin-activity'

describe('DeleteCategoryHandler', () => {
    let handler: DeleteCategoryHandler
    let mockRepo: {
        findById: jest.Mock
        countGigsForCategory: jest.Mock
        bulkReassignGigs: jest.Mock
        delete: jest.Mock
        findFallbackCategoryId: jest.Mock
    }
    let mockActivity: { log: jest.Mock }

    const target = new CategoryEntity({ id: 'cat-1', name: 'Tutoring', icon: 'BookOutlined' })
    const reassignTarget = new CategoryEntity({ id: 'cat-2', name: 'Design', icon: 'BgColorsOutlined' })

    beforeEach(async () => {
        mockRepo = {
            findById: jest.fn(),
            countGigsForCategory: jest.fn(),
            bulkReassignGigs: jest.fn(),
            delete: jest.fn(),
            findFallbackCategoryId: jest.fn()
        }
        mockActivity = { log: jest.fn() }

        const mockEventBus = { publish: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeleteCategoryHandler,
                { provide: CATEGORY_REPOSITORY_PORT, useValue: mockRepo },
                { provide: ADMIN_ACTIVITY_REPOSITORY_PORT, useValue: mockActivity },
                { provide: EventBus, useValue: mockEventBus }
            ]
        }).compile()

        handler = module.get<DeleteCategoryHandler>(DeleteCategoryHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('throws CategoryNotFoundException when target does not exist', async () => {
        mockRepo.findById.mockResolvedValue(null)
        await expect(handler.execute(new DeleteCategoryCommand('missing', null, 'admin-1'))).rejects.toThrow(
            CategoryNotFoundException
        )
    })

    it('deletes without reassignment when category has 0 gigs', async () => {
        mockRepo.findById.mockResolvedValue(target)
        mockRepo.countGigsForCategory.mockResolvedValue(0)

        await handler.execute(new DeleteCategoryCommand('cat-1', null, 'admin-1'))

        expect(mockRepo.delete).toHaveBeenCalledWith('cat-1')
        expect(mockRepo.bulkReassignGigs).not.toHaveBeenCalled()
        expect(mockActivity.log).toHaveBeenCalledWith(
            expect.objectContaining({ actionType: 'category_deleted', targetType: 'category', targetId: 'cat-1' })
        )
    })

    it('rehomes leftover soft-deleted gigs to a fallback before deleting (0 active gigs)', async () => {
        mockRepo.findById.mockResolvedValue(target)
        mockRepo.countGigsForCategory.mockResolvedValue(0)
        mockRepo.findFallbackCategoryId.mockResolvedValue('cat-2')

        await handler.execute(new DeleteCategoryCommand('cat-1', null, 'admin-1'))

        expect(mockRepo.bulkReassignGigs).toHaveBeenCalledWith('cat-1', 'cat-2')
        expect(mockRepo.delete).toHaveBeenCalledWith('cat-1')
    })

    it('ignores reassignTo when category has 0 gigs', async () => {
        mockRepo.findById.mockResolvedValue(target)
        mockRepo.countGigsForCategory.mockResolvedValue(0)

        await handler.execute(new DeleteCategoryCommand('cat-1', 'cat-2', 'admin-1'))

        expect(mockRepo.bulkReassignGigs).not.toHaveBeenCalled()
        expect(mockRepo.delete).toHaveBeenCalledWith('cat-1')
    })

    it('throws CategoryHasGigsException when has gigs and no reassignTo', async () => {
        mockRepo.findById.mockResolvedValue(target)
        mockRepo.countGigsForCategory.mockResolvedValue(7)

        await expect(handler.execute(new DeleteCategoryCommand('cat-1', null, 'admin-1'))).rejects.toThrow(
            CategoryHasGigsException
        )
        expect(mockRepo.delete).not.toHaveBeenCalled()
    })

    it('throws InvalidReassignTargetException when reassignTo is self', async () => {
        mockRepo.findById.mockResolvedValue(target)
        mockRepo.countGigsForCategory.mockResolvedValue(7)

        await expect(handler.execute(new DeleteCategoryCommand('cat-1', 'cat-1', 'admin-1'))).rejects.toThrow(
            InvalidReassignTargetException
        )
    })

    it('throws InvalidReassignTargetException when reassignTo does not exist', async () => {
        mockRepo.findById.mockImplementation((id) => {
            if (id === 'cat-1') return Promise.resolve(target)
            return Promise.resolve(null)
        })
        mockRepo.countGigsForCategory.mockResolvedValue(7)

        await expect(handler.execute(new DeleteCategoryCommand('cat-1', 'missing', 'admin-1'))).rejects.toThrow(
            InvalidReassignTargetException
        )
    })

    it('reassigns gigs then deletes when has gigs and reassignTo is valid', async () => {
        mockRepo.findById.mockImplementation((id) => {
            if (id === 'cat-1') return Promise.resolve(target)
            if (id === 'cat-2') return Promise.resolve(reassignTarget)
            return Promise.resolve(null)
        })
        mockRepo.countGigsForCategory.mockResolvedValue(7)

        await handler.execute(new DeleteCategoryCommand('cat-1', 'cat-2', 'admin-1'))

        expect(mockRepo.bulkReassignGigs).toHaveBeenCalledWith('cat-1', 'cat-2')
        expect(mockRepo.delete).toHaveBeenCalledWith('cat-1')
    })
})
