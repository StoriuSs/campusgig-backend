import { Test, TestingModule } from '@nestjs/testing'
import { GetPublicProfileByUsernameHandler } from './get-public-profile-by-username.handler'
import { GetPublicProfileByUsernameQuery } from './get-public-profile-by-username.query'
import { USER_REPOSITORY_PORT, UserEntity, UserNotFoundException } from '@/modules/users/domain'

describe('GetPublicProfileByUsernameHandler', () => {
    let handler: GetPublicProfileByUsernameHandler
    let mockUserRepo: { findByUsernameWithRelations: jest.Mock }

    beforeEach(async () => {
        mockUserRepo = { findByUsernameWithRelations: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [GetPublicProfileByUsernameHandler, { provide: USER_REPOSITORY_PORT, useValue: mockUserRepo }]
        }).compile()

        handler = module.get<GetPublicProfileByUsernameHandler>(GetPublicProfileByUsernameHandler)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should return the user bundle when found, lowercasing the lookup', async () => {
        const user = new UserEntity({ id: 'u1', keycloakId: 'kc', username: 'sarah' })
        const bundle = { user, skills: [], portfolioItems: [] }
        mockUserRepo.findByUsernameWithRelations.mockResolvedValue(bundle)

        const result = await handler.execute(new GetPublicProfileByUsernameQuery('Sarah'))

        expect(mockUserRepo.findByUsernameWithRelations).toHaveBeenCalledWith('sarah')
        expect(result).toBe(bundle)
    })

    it('should throw UserNotFoundException when username does not match', async () => {
        mockUserRepo.findByUsernameWithRelations.mockResolvedValue(null)

        await expect(handler.execute(new GetPublicProfileByUsernameQuery('nobody'))).rejects.toThrow(
            UserNotFoundException
        )
    })
})
