import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { CleanupOldAvatarHandler } from './cleanup-old-avatar.handler'
import { AvatarUploadedEvent } from '../avatar-uploaded.event'

describe('CleanupOldAvatarHandler', () => {
    let handler: CleanupOldAvatarHandler
    let mockQueue: { add: jest.Mock }

    beforeEach(async () => {
        mockQueue = {
            add: jest.fn()
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CleanupOldAvatarHandler,
                {
                    provide: getQueueToken('file-cleanup'),
                    useValue: mockQueue
                }
            ]
        }).compile()

        handler = module.get<CleanupOldAvatarHandler>(CleanupOldAvatarHandler)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should enqueue a job to delete the old avatar', async () => {
        const event = new AvatarUploadedEvent('user-123', 'https://s3.amazonaws.com/uploads/uuid-avatar.png')

        await handler.handle(event)

        expect(mockQueue.add).toHaveBeenCalledWith(
            'delete-avatar',
            { filePath: 'uuid-avatar.png' },
            expect.objectContaining({
                attempts: 5,
                removeOnComplete: true
            })
        )
    })

    it('should handle standard URLs without the uploads/ prefix', async () => {
        const event = new AvatarUploadedEvent('user-123', 'standard-avatar.png')

        await handler.handle(event)

        expect(mockQueue.add).toHaveBeenCalledWith(
            'delete-avatar',
            { filePath: 'standard-avatar.png' },
            expect.any(Object)
        )
    })

    it('should catch errors and log them without throwing (fire and forget)', async () => {
        const event = new AvatarUploadedEvent('user-123', 'avatar.png')

        mockQueue.add.mockRejectedValue(new Error('Redis connection lost'))

        // We use spyOn just to suppress console errors during test run
        const loggerSpy = jest
            .spyOn((handler as unknown as { logger: { error: jest.Mock } }).logger, 'error')
            .mockImplementation()

        await expect(handler.handle(event)).resolves.not.toThrow()

        expect(loggerSpy).toHaveBeenCalledWith('Failed to enqueue avatar deletion', expect.any(Error))

        loggerSpy.mockRestore()
    })
})
