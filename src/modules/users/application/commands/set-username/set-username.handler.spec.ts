import { Test, TestingModule } from '@nestjs/testing'
import { EventBus } from '@nestjs/cqrs'
import { SetUsernameHandler } from './set-username.handler'
import { SetUsernameCommand } from './set-username.command'
import { USER_REPOSITORY_PORT, UserEntity } from '@/modules/users/domain'
import { UserNotFoundException, UsernameAlreadySetException } from '@/modules/users/domain'
import { UserProfileUpdatedEvent } from '../../events/user-profile-updated.event'

describe('SetUsernameHandler', () => {
    let handler: SetUsernameHandler
    let mockUserRepo: { findById: jest.Mock; update: jest.Mock }
    let mockEventBus: { publish: jest.Mock }

    beforeEach(async () => {
        // Mock the User Repo Port
        mockUserRepo = {
            findById: jest.fn(),
            update: jest.fn()
        }

        // Mock the CQRS Event Bus
        mockEventBus = {
            publish: jest.fn()
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SetUsernameHandler,
                { provide: USER_REPOSITORY_PORT, useValue: mockUserRepo },
                { provide: EventBus, useValue: mockEventBus }
            ]
        }).compile()

        handler = module.get<SetUsernameHandler>(SetUsernameHandler)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should successfully set the username and publish an event', async () => {
        const userId = 'user-123'
        const command = new SetUsernameCommand(userId, 'johndoe')

        const existingUser = new UserEntity({
            id: userId,
            keycloakId: 'kc-123',
            email: 'test@example.com',
            hasSetUsername: false
        })

        const updatedUser = new UserEntity({
            id: userId,
            keycloakId: 'kc-123',
            email: 'test@example.com',
            username: 'johndoe',
            hasSetUsername: true
        })

        mockUserRepo.findById.mockResolvedValue(existingUser)
        mockUserRepo.update.mockResolvedValue(updatedUser)

        const result = await handler.execute(command)

        expect(mockUserRepo.findById).toHaveBeenCalledWith(userId)
        expect(mockUserRepo.update).toHaveBeenCalledWith(userId, {
            username: 'johndoe',
            hasSetUsername: true
        })
        expect(mockEventBus.publish).toHaveBeenCalledWith(
            new UserProfileUpdatedEvent(updatedUser.id, updatedUser.keycloakId)
        )
        expect(result).toEqual(updatedUser)
    })

    it('should throw UserNotFoundException if user does not exist', async () => {
        const command = new SetUsernameCommand('non-existent', 'johndoe')

        mockUserRepo.findById.mockResolvedValue(null)

        await expect(handler.execute(command)).rejects.toThrow(UserNotFoundException)

        expect(mockUserRepo.findById).toHaveBeenCalledWith('non-existent')
        expect(mockUserRepo.update).not.toHaveBeenCalled()
        expect(mockEventBus.publish).not.toHaveBeenCalled()
    })

    it('should throw UsernameAlreadySetException if user already set username', async () => {
        const userId = 'user-123'
        const command = new SetUsernameCommand(userId, 'newusername')

        const existingUser = new UserEntity({
            id: userId,
            keycloakId: 'kc-123',
            email: 'test@example.com',
            username: 'oldusername',
            hasSetUsername: true // Already set
        })

        mockUserRepo.findById.mockResolvedValue(existingUser)

        await expect(handler.execute(command)).rejects.toThrow(UsernameAlreadySetException)

        expect(mockUserRepo.findById).toHaveBeenCalledWith(userId)
        expect(mockUserRepo.update).not.toHaveBeenCalled()
        expect(mockEventBus.publish).not.toHaveBeenCalled()
    })

    it('should bubble up exceptions thrown by the repository during update', async () => {
        const userId = 'user-123'
        const command = new SetUsernameCommand(userId, 'johndoe')

        const existingUser = new UserEntity({
            id: userId,
            keycloakId: 'kc-123',
            email: 'test@example.com',
            hasSetUsername: false
        })

        mockUserRepo.findById.mockResolvedValue(existingUser)

        // Simulate UsernameTakenException (or any other DB error)
        const errorMessage = 'Username already taken'
        mockUserRepo.update.mockRejectedValue(new Error(errorMessage))

        await expect(handler.execute(command)).rejects.toThrow(errorMessage)

        // Ensure event wasn't published
        expect(mockEventBus.publish).not.toHaveBeenCalled()
    })
})
