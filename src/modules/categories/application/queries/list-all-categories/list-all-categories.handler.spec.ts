import { Test, TestingModule } from '@nestjs/testing'
import { ListAllCategoriesHandler } from './list-all-categories.handler'
import { ListAllCategoriesQuery } from './list-all-categories.query'
import { CATEGORY_REPOSITORY_PORT, CategoryEntity } from '@/modules/categories/domain'

describe('ListAllCategoriesHandler', () => {
    let handler: ListAllCategoriesHandler
    let mockRepo: { findAll: jest.Mock }

    beforeEach(async () => {
        mockRepo = { findAll: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [ListAllCategoriesHandler, { provide: CATEGORY_REPOSITORY_PORT, useValue: mockRepo }]
        }).compile()

        handler = module.get<ListAllCategoriesHandler>(ListAllCategoriesHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('returns empty list when no categories exist', async () => {
        mockRepo.findAll.mockResolvedValue([])
        const result = await handler.execute(new ListAllCategoriesQuery())
        expect(result).toEqual([])
    })

    it('returns categories as the repo returns them', async () => {
        const categories = [
            new CategoryEntity({ id: 'a', name: 'Art', icon: 'BgColorsOutlined' }),
            new CategoryEntity({ id: 'b', name: 'Tutoring', icon: 'BookOutlined' })
        ]
        mockRepo.findAll.mockResolvedValue(categories)

        const result = await handler.execute(new ListAllCategoriesQuery())
        expect(result).toBe(categories)
    })
})
