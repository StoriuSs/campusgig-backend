import { Test, TestingModule } from '@nestjs/testing'
import { EventBus } from '@nestjs/cqrs'
import { DeleteAccountHandler } from './delete-account.handler'
import { DeleteAccountCommand } from './delete-account.command'
import { USER_REPOSITORY_PORT, UserEntity } from '@/modules/users/domain'
import { UserNotFoundException } from '@/modules/users/domain'
import { AccountDeletedEvent } from '@/modules/users/application'

describe('DeleteAccountHandler', () => {
    let handler: DeleteAccountHandler
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
                DeleteAccountHandler,
                { provide: USER_REPOSITORY_PORT, useValue: mockUserRepo },
                { provide: EventBus, useValue: mockEventBus }
            ]
        }).compile()

        handler = module.get<DeleteAccountHandler>(DeleteAccountHandler)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should soft delete user and publish an event', async () => {
        const userId = 'user-123'
        const actorId = 'admin-456'
        const command = new DeleteAccountCommand(userId, actorId)

        const existingUser = new UserEntity({
            id: userId,
            keycloakId: 'kc-123',
            email: 'test@example.com',
            deletedAt: null,
            deletedBy: null
        })

        mockUserRepo.findById.mockResolvedValue(existingUser)
        mockUserRepo.update.mockResolvedValue({})

        await handler.execute(command)

        expect(mockUserRepo.findById).toHaveBeenCalledWith(userId)

        // Assert the update was called with a date and the actor ID
        expect(mockUserRepo.update).toHaveBeenCalledWith(
            userId,
            expect.objectContaining({
                deletedAt: expect.any(Date),
                deletedBy: actorId
            })
        )

        expect(mockEventBus.publish).toHaveBeenCalledWith(new AccountDeletedEvent(userId, existingUser.keycloakId))
    })

    it('should use the user ID as actor ID if none is provided', async () => {
        const userId = 'user-123'
        const command = new DeleteAccountCommand(userId) // no actor ID

        const existingUser = new UserEntity({
            id: userId,
            keycloakId: 'kc-123',
            email: 'test@example.com'
        })

        mockUserRepo.findById.mockResolvedValue(existingUser)
        mockUserRepo.update.mockResolvedValue({})

        await handler.execute(command)

        expect(mockUserRepo.update).toHaveBeenCalledWith(
            userId,
            expect.objectContaining({
                deletedAt: expect.any(Date),
                deletedBy: userId // fallback to self
            })
        )
    })

    it('should throw UserNotFoundException if user does not exist', async () => {
        const command = new DeleteAccountCommand('non-existent')

        mockUserRepo.findById.mockResolvedValue(null)

        await expect(handler.execute(command)).rejects.toThrow(UserNotFoundException)

        expect(mockUserRepo.findById).toHaveBeenCalledWith('non-existent')
        expect(mockUserRepo.update).not.toHaveBeenCalled()
        expect(mockEventBus.publish).not.toHaveBeenCalled()
    })

    it('should bubble up exceptions thrown by the repository during update', async () => {
        const userId = 'user-123'
        const command = new DeleteAccountCommand(userId)

        const existingUser = new UserEntity({
            id: userId,
            keycloakId: 'kc-123',
            email: 'test@example.com'
        })

        mockUserRepo.findById.mockResolvedValue(existingUser)

        const errorMessage = 'Repository update failed'
        mockUserRepo.update.mockRejectedValue(new Error(errorMessage))

        await expect(handler.execute(command)).rejects.toThrow(errorMessage)

        expect(mockEventBus.publish).not.toHaveBeenCalled()
    })
})
