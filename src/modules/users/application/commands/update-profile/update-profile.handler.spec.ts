import { Test, TestingModule } from '@nestjs/testing'
import { EventBus } from '@nestjs/cqrs'
import { UpdateProfileHandler } from './update-profile.handler'
import { UpdateProfileCommand } from './update-profile.command'
import { USER_REPOSITORY_PORT, UserEntity } from '@/modules/users/domain'
import { UserProfileUpdatedEvent } from '../../events/user-profile-updated.event'

describe('UpdateProfileHandler', () => {
    let handler: UpdateProfileHandler
    let mockUserRepo: { update: jest.Mock }
    let mockEventBus: { publish: jest.Mock }

    beforeEach(async () => {
        // Mock the User Repo Port
        mockUserRepo = {
            update: jest.fn()
        }

        // Mock the CQRS Event Bus
        mockEventBus = {
            publish: jest.fn()
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UpdateProfileHandler,
                { provide: USER_REPOSITORY_PORT, useValue: mockUserRepo },
                { provide: EventBus, useValue: mockEventBus }
            ]
        }).compile()

        handler = module.get<UpdateProfileHandler>(UpdateProfileHandler)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should update the user profile and publish an event', async () => {
        const userId = 'user-123'
        const command = new UpdateProfileCommand(userId, 'John Doe', 'Hello world')

        const updatedUser = new UserEntity({
            id: userId,
            keycloakId: 'kc-123',
            email: 'test@example.com',
            displayName: 'John Doe',
            bio: 'Hello world'
        })

        mockUserRepo.update.mockResolvedValue(updatedUser)

        const result = await handler.execute(command)

        expect(mockUserRepo.update).toHaveBeenCalledWith(userId, {
            displayName: 'John Doe',
            bio: 'Hello world'
        })
        expect(mockEventBus.publish).toHaveBeenCalledWith(new UserProfileUpdatedEvent(userId, 'kc-123'))
        expect(result).toEqual(updatedUser)
    })

    it('should only update fields that are provided', async () => {
        const userId = 'user-123'
        const command = new UpdateProfileCommand(userId, 'John Doe') // no bio

        const updatedUser = new UserEntity({
            id: userId,
            keycloakId: 'kc-123',
            email: 'test@example.com',
            displayName: 'John Doe'
        })

        mockUserRepo.update.mockResolvedValue(updatedUser)

        await handler.execute(command)

        expect(mockUserRepo.update).toHaveBeenCalledWith(userId, {
            displayName: 'John Doe'
        })
    })

    it('should bubble up exceptions thrown by the repository', async () => {
        const command = new UpdateProfileCommand('user-123', 'John Doe')
        const errorMessage = 'Repository update error'

        mockUserRepo.update.mockRejectedValue(new Error(errorMessage))

        await expect(handler.execute(command)).rejects.toThrow(errorMessage)

        // Ensure event wasn't published
        expect(mockEventBus.publish).not.toHaveBeenCalled()
    })
})
