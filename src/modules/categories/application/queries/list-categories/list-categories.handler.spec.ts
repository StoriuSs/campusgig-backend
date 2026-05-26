import { Test, TestingModule } from '@nestjs/testing'
import { ListCategoriesHandler } from './list-categories.handler'
import { ListCategoriesQuery } from './list-categories.query'
import { CATEGORY_REPOSITORY_PORT } from '@/modules/categories/domain'

describe('ListCategoriesHandler', () => {
    let handler: ListCategoriesHandler
    let mockRepo: { listPaginated: jest.Mock }

    beforeEach(async () => {
        mockRepo = { listPaginated: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [ListCategoriesHandler, { provide: CATEGORY_REPOSITORY_PORT, useValue: mockRepo }]
        }).compile()

        handler = module.get<ListCategoriesHandler>(ListCategoriesHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('clamps page to >= 1', async () => {
        mockRepo.listPaginated.mockResolvedValue({ items: [], total: 0 })
        await handler.execute(new ListCategoriesQuery(-5, 20))
        expect(mockRepo.listPaginated).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
    })

    it('clamps pageSize between 1 and 100', async () => {
        mockRepo.listPaginated.mockResolvedValue({ items: [], total: 0 })
        await handler.execute(new ListCategoriesQuery(1, 999))
        expect(mockRepo.listPaginated).toHaveBeenCalledWith({ page: 1, pageSize: 100 })

        await handler.execute(new ListCategoriesQuery(1, 0))
        expect(mockRepo.listPaginated).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
    })

    it('passes through valid page/pageSize', async () => {
        mockRepo.listPaginated.mockResolvedValue({ items: [], total: 5 })
        await handler.execute(new ListCategoriesQuery(2, 25))
        expect(mockRepo.listPaginated).toHaveBeenCalledWith({ page: 2, pageSize: 25 })
    })

    it('returns whatever the repo returns', async () => {
        const fixture = { items: [], total: 0 }
        mockRepo.listPaginated.mockResolvedValue(fixture)
        const result = await handler.execute(new ListCategoriesQuery(1, 20))
        expect(result).toBe(fixture)
    })
})
