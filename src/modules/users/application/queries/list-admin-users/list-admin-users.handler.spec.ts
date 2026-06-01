import { Test, TestingModule } from '@nestjs/testing'

import { USER_REPOSITORY_PORT } from '@/modules/users/domain'
import { ListAdminUsersHandler } from './list-admin-users.handler'
import { ListAdminUsersQuery } from './list-admin-users.query'

describe('ListAdminUsersHandler', () => {
    let handler: ListAdminUsersHandler
    let repo: { listForAdmin: jest.Mock }

    beforeEach(async () => {
        repo = {
            listForAdmin: jest.fn().mockResolvedValue({ items: [], total: 0, totalUsers: 5, endorsedUsers: 1 })
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [ListAdminUsersHandler, { provide: USER_REPOSITORY_PORT, useValue: repo }]
        }).compile()

        handler = module.get(ListAdminUsersHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('forwards the filters to the repository', async () => {
        const filters = {
            sort: 'mostOrders' as const,
            endorsedOnly: true,
            search: 'jane',
            page: 2,
            pageSize: 10
        }

        const result = await handler.execute(new ListAdminUsersQuery(filters))

        expect(repo.listForAdmin).toHaveBeenCalledWith(filters)
        expect(result.totalUsers).toBe(5)
        expect(result.endorsedUsers).toBe(1)
    })
})
