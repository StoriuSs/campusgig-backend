import { Test, TestingModule } from '@nestjs/testing'
import { CheckUsernameHandler } from './check-username.handler'
import { CheckUsernameQuery } from './check-username.query'
import { USER_REPOSITORY_PORT, UserEntity } from '@/modules/users/domain'

describe('CheckUsernameHandler', () => {
    let handler: CheckUsernameHandler
    let mockUserRepo: { findByUsername: jest.Mock }

    beforeEach(async () => {
        // Mock the User Repo Port
        mockUserRepo = {
            findByUsername: jest.fn()
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [CheckUsernameHandler, { provide: USER_REPOSITORY_PORT, useValue: mockUserRepo }]
        }).compile()

        handler = module.get<CheckUsernameHandler>(CheckUsernameHandler)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should return true if username is available (not found)', async () => {
        const query = new CheckUsernameQuery('new-username')

        // Mock repository returning null (meaning username is available)
        mockUserRepo.findByUsername.mockResolvedValue(null)

        const result = await handler.execute(query)

        expect(mockUserRepo.findByUsername).toHaveBeenCalledWith('new-username')
        expect(result).toBe(true)
    })

    it('should return false if username is taken (found)', async () => {
        const query = new CheckUsernameQuery('existing-username')

        // Mock repository returning a user entity (meaning username is taken)
        const existingUser = new UserEntity({
            id: 'user-123',
            keycloakId: 'kc-123',
            email: 'test@example.com',
            username: 'existing-username'
        })
        mockUserRepo.findByUsername.mockResolvedValue(existingUser)

        const result = await handler.execute(query)

        expect(mockUserRepo.findByUsername).toHaveBeenCalledWith('existing-username')
        expect(result).toBe(false)
    })

    it('should bubble up exceptions from the repository', async () => {
        const query = new CheckUsernameQuery('username')
        const errorMessage = 'Database error'

        mockUserRepo.findByUsername.mockRejectedValue(new Error(errorMessage))

        await expect(handler.execute(query)).rejects.toThrow(errorMessage)
    })
})
