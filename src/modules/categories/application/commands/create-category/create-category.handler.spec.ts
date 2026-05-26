import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { CreateCategoryHandler } from './create-category.handler'
import { CreateCategoryCommand } from './create-category.command'
import {
    CATEGORY_REPOSITORY_PORT,
    CategoryEntity,
    DuplicateCategoryNameException,
    InvalidCategoryIconException
} from '@/modules/categories/domain'

describe('CreateCategoryHandler', () => {
    let handler: CreateCategoryHandler
    let mockRepo: { findByNameInsensitive: jest.Mock; create: jest.Mock }

    beforeEach(async () => {
        mockRepo = {
            findByNameInsensitive: jest.fn(),
            create: jest.fn()
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [CreateCategoryHandler, { provide: CATEGORY_REPOSITORY_PORT, useValue: mockRepo }]
        }).compile()

        handler = module.get<CreateCategoryHandler>(CreateCategoryHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('creates a category when input is valid', async () => {
        mockRepo.findByNameInsensitive.mockResolvedValue(null)
        const created = new CategoryEntity({
            id: 'cat-1',
            name: 'Tutoring',
            icon: 'BookOutlined',
            description: 'Help with classes',
            createdById: 'admin-1'
        })
        mockRepo.create.mockResolvedValue(created)

        const result = await handler.execute(
            new CreateCategoryCommand('  Tutoring  ', 'BookOutlined', 'Help with classes', 'admin-1')
        )

        expect(mockRepo.create).toHaveBeenCalledWith({
            name: 'Tutoring',
            icon: 'BookOutlined',
            description: 'Help with classes',
            createdById: 'admin-1'
        })
        expect(result).toBe(created)
    })

    it('rejects empty / whitespace-only names', async () => {
        await expect(handler.execute(new CreateCategoryCommand('', 'BookOutlined', null, 'admin-1'))).rejects.toThrow(
            BadRequestException
        )
        await expect(
            handler.execute(new CreateCategoryCommand('   ', 'BookOutlined', null, 'admin-1'))
        ).rejects.toThrow(BadRequestException)
        expect(mockRepo.create).not.toHaveBeenCalled()
    })

    it('rejects names longer than 50 chars', async () => {
        await expect(
            handler.execute(new CreateCategoryCommand('x'.repeat(51), 'BookOutlined', null, 'admin-1'))
        ).rejects.toThrow(BadRequestException)
    })

    it('rejects descriptions longer than 200 chars', async () => {
        mockRepo.findByNameInsensitive.mockResolvedValue(null)
        await expect(
            handler.execute(new CreateCategoryCommand('Tutoring', 'BookOutlined', 'x'.repeat(201), 'admin-1'))
        ).rejects.toThrow(BadRequestException)
    })

    it('rejects icons not in the allowed list', async () => {
        await expect(
            handler.execute(new CreateCategoryCommand('Tutoring', 'NotARealIcon', null, 'admin-1'))
        ).rejects.toThrow(InvalidCategoryIconException)
    })

    it('rejects duplicate names (case-insensitive)', async () => {
        mockRepo.findByNameInsensitive.mockResolvedValue(
            new CategoryEntity({ id: 'existing', name: 'tutoring', icon: 'BookOutlined' })
        )

        await expect(
            handler.execute(new CreateCategoryCommand('Tutoring', 'BookOutlined', null, 'admin-1'))
        ).rejects.toThrow(DuplicateCategoryNameException)
        expect(mockRepo.create).not.toHaveBeenCalled()
    })

    it('treats empty/whitespace description as null', async () => {
        mockRepo.findByNameInsensitive.mockResolvedValue(null)
        mockRepo.create.mockResolvedValue(new CategoryEntity({ id: 'cat-1', name: 'Tutoring', icon: 'BookOutlined' }))

        await handler.execute(new CreateCategoryCommand('Tutoring', 'BookOutlined', '   ', 'admin-1'))

        expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ description: null }))
    })
})
