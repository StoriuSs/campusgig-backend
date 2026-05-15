import { Test, TestingModule } from '@nestjs/testing'
import { EventBus } from '@nestjs/cqrs'
import { UploadAvatarHandler } from './upload-avatar.handler'
import { UploadAvatarCommand } from './upload-avatar.command'
import { USER_REPOSITORY_PORT, UserEntity } from '@/modules/users/domain'
import { STORAGE_PORT, UploadedFileResult } from '../../ports'
import { AvatarUploadedEvent } from '../../events/avatar-uploaded.event'
import { UserProfileUpdatedEvent } from '../../events/user-profile-updated.event'

describe('UploadAvatarHandler', () => {
    let handler: UploadAvatarHandler
    let mockUserRepo: { findAvatarUrl: jest.Mock; update: jest.Mock }
    let mockStorage: { uploadAvatar: jest.Mock }
    let mockEventBus: { publish: jest.Mock }

    beforeEach(async () => {
        // Mock the User Repo
        mockUserRepo = {
            findAvatarUrl: jest.fn(),
            update: jest.fn()
        }

        // Mock the Storage Port
        mockStorage = {
            uploadAvatar: jest.fn()
        }

        // Mock the Event Bus
        mockEventBus = {
            publish: jest.fn()
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UploadAvatarHandler,
                { provide: USER_REPOSITORY_PORT, useValue: mockUserRepo },
                { provide: STORAGE_PORT, useValue: mockStorage },
                { provide: EventBus, useValue: mockEventBus }
            ]
        }).compile()

        handler = module.get<UploadAvatarHandler>(UploadAvatarHandler)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should upload avatar, update database, and publish events', async () => {
        const userId = 'user-123'
        const fileBuffer = Buffer.from('test-image-data')
        const originalName = 'avatar.png'
        const command = new UploadAvatarCommand(userId, fileBuffer, originalName)

        const currentAvatarUrl = 'https://old-avatar.com/image.png'
        const uploadedFile: UploadedFileResult = {
            key: 'https://new-avatar.com/image.png',
            path: 'https://new-avatar.com/image.png'
        }

        const updatedUser = new UserEntity({
            id: userId,
            keycloakId: 'kc-123',
            email: 'test@example.com',
            avatarUrl: uploadedFile.key
        })

        // Mock concurrent dependencies
        mockUserRepo.findAvatarUrl.mockResolvedValue(currentAvatarUrl)
        mockStorage.uploadAvatar.mockResolvedValue(uploadedFile)
        mockUserRepo.update.mockResolvedValue(updatedUser)

        const result = await handler.execute(command)

        // Verify parallel execution of find/upload
        expect(mockUserRepo.findAvatarUrl).toHaveBeenCalledWith(userId)
        expect(mockStorage.uploadAvatar).toHaveBeenCalledWith(fileBuffer, originalName, userId)

        // Verify database update
        expect(mockUserRepo.update).toHaveBeenCalledWith(userId, { avatarUrl: uploadedFile.key })

        // Verify two events published
        expect(mockEventBus.publish).toHaveBeenCalledWith(new AvatarUploadedEvent(userId, currentAvatarUrl))
        expect(mockEventBus.publish).toHaveBeenCalledWith(new UserProfileUpdatedEvent(userId, 'kc-123'))

        expect(result).toEqual({ user: updatedUser, upload: uploadedFile })
    })

    it('should not publish AvatarUploadedEvent if user has no current avatar', async () => {
        const userId = 'user-123'
        const fileBuffer = Buffer.from('test-image-data')
        const command = new UploadAvatarCommand(userId, fileBuffer, 'avatar.png')

        const uploadedFile: UploadedFileResult = {
            key: 'https://new-avatar.com/image.png',
            path: 'https://new-avatar.com/image.png'
        }

        const updatedUser = new UserEntity({
            id: userId,
            keycloakId: 'kc-123',
            email: 'test@example.com',
            avatarUrl: uploadedFile.key
        })

        // User has no current avatar (null)
        mockUserRepo.findAvatarUrl.mockResolvedValue(null)
        mockStorage.uploadAvatar.mockResolvedValue(uploadedFile)
        mockUserRepo.update.mockResolvedValue(updatedUser)

        await handler.execute(command)

        // Only one event published (for caching), NO AvatarUploadedEvent (for cleanup)
        expect(mockEventBus.publish).toHaveBeenCalledTimes(1)
        expect(mockEventBus.publish).toHaveBeenCalledWith(new UserProfileUpdatedEvent(userId, 'kc-123'))
    })

    it('should bubble up exceptions from storage upload', async () => {
        const command = new UploadAvatarCommand('user-123', Buffer.from('data'), 'avatar.png')

        mockUserRepo.findAvatarUrl.mockResolvedValue('old-url')
        mockStorage.uploadAvatar.mockRejectedValue(new Error('S3 error'))

        await expect(handler.execute(command)).rejects.toThrow('S3 error')

        expect(mockUserRepo.update).not.toHaveBeenCalled()
        expect(mockEventBus.publish).not.toHaveBeenCalled()
    })
})
