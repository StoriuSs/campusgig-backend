import { Test, TestingModule } from '@nestjs/testing'

import { USER_REPOSITORY_PORT, UserNotFoundException } from '@/modules/users/domain'
import { GetAdminUserDetailHandler } from './get-admin-user-detail.handler'
import { GetAdminUserDetailQuery } from './get-admin-user-detail.query'

describe('GetAdminUserDetailHandler', () => {
    let handler: GetAdminUserDetailHandler
    let repo: { getAdminDetail: jest.Mock }

    beforeEach(async () => {
        repo = { getAdminDetail: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [GetAdminUserDetailHandler, { provide: USER_REPOSITORY_PORT, useValue: repo }]
        }).compile()

        handler = module.get(GetAdminUserDetailHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('returns the detail when the user exists', async () => {
        const detail = { id: 'u1', topGigs: [] }
        repo.getAdminDetail.mockResolvedValue(detail)

        await expect(handler.execute(new GetAdminUserDetailQuery('u1'))).resolves.toBe(detail)
        expect(repo.getAdminDetail).toHaveBeenCalledWith('u1')
    })

    it('throws UserNotFoundException when the user is missing', async () => {
        repo.getAdminDetail.mockResolvedValue(null)

        await expect(handler.execute(new GetAdminUserDetailQuery('missing'))).rejects.toThrow(UserNotFoundException)
    })
})
