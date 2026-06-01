import { Test, TestingModule } from '@nestjs/testing'

import { ADMIN_ACTIVITY_REPOSITORY_PORT } from '../../../domain/ports/admin-activity.repository.port'
import { ListActivityHandler } from './list-activity.handler'
import { ListActivityQuery } from './list-activity.query'

describe('ListActivityHandler', () => {
    let handler: ListActivityHandler
    let repo: { list: jest.Mock; listAdmins: jest.Mock }

    beforeEach(async () => {
        repo = {
            list: jest.fn().mockResolvedValue({ items: [{ id: 'a1' }], total: 1 }),
            listAdmins: jest.fn().mockResolvedValue([{ id: 'admin-1', email: 'a@uni.edu' }])
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [ListActivityHandler, { provide: ADMIN_ACTIVITY_REPOSITORY_PORT, useValue: repo }]
        }).compile()

        handler = module.get(ListActivityHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('forwards filters + pagination to the repo and merges the admin list', async () => {
        const from = new Date('2026-05-01T00:00:00.000Z')
        const to = new Date('2026-05-31T23:59:59.999Z')

        const result = await handler.execute(new ListActivityQuery('withdrawals', 'admin-1', from, to, 2, 10))

        expect(repo.list).toHaveBeenCalledWith({
            filter: 'withdrawals',
            adminUserId: 'admin-1',
            from,
            to,
            page: 2,
            pageSize: 10
        })
        expect(repo.listAdmins).toHaveBeenCalled()
        expect(result.total).toBe(1)
        expect(result.items).toHaveLength(1)
        expect(result.admins).toEqual([{ id: 'admin-1', email: 'a@uni.edu' }])
    })

    it('passes undefined bounds when no admin / dates are given', async () => {
        await handler.execute(new ListActivityQuery('all', undefined, undefined, undefined, 1, 10))

        expect(repo.list).toHaveBeenCalledWith({
            filter: 'all',
            adminUserId: undefined,
            from: undefined,
            to: undefined,
            page: 1,
            pageSize: 10
        })
    })
})
