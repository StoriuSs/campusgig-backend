import { Test, TestingModule } from '@nestjs/testing'
import { InvalidateCacheHandler } from './invalidate-cache.handler'
import { UserProfileUpdatedEvent } from '../user-profile-updated.event'
import { AccountDeletedEvent } from '../account-deleted.event'
import { CACHE_PORT } from '../../ports'

describe('InvalidateCacheHandler', () => {
    let handler: InvalidateCacheHandler
    let mockCache: { invalidateUser: jest.Mock }

    beforeEach(async () => {
        mockCache = {
            invalidateUser: jest.fn()
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InvalidateCacheHandler,
                {
                    provide: CACHE_PORT,
                    useValue: mockCache
                }
            ]
        }).compile()

        handler = module.get<InvalidateCacheHandler>(InvalidateCacheHandler)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should invalidate cache when UserProfileUpdatedEvent is received', async () => {
        const event = new UserProfileUpdatedEvent('user-123', 'kc-123')

        await handler.handle(event)

        expect(mockCache.invalidateUser).toHaveBeenCalledWith('kc-123')
    })

    it('should invalidate cache when AccountDeletedEvent is received', async () => {
        const event = new AccountDeletedEvent('user-123', 'kc-123')

        await handler.handle(event)

        expect(mockCache.invalidateUser).toHaveBeenCalledWith('kc-123')
    })

    it('should catch errors and log them without throwing (fire and forget cache)', async () => {
        const event = new UserProfileUpdatedEvent('user-123', 'kc-123')

        mockCache.invalidateUser.mockRejectedValue(new Error('Redis connection lost'))

        // We use spyOn just to suppress console warnings during test run
        const loggerSpy = jest
            .spyOn((handler as unknown as { logger: { warn: jest.Mock } }).logger, 'warn')
            .mockImplementation()

        await expect(handler.handle(event)).resolves.not.toThrow()

        expect(loggerSpy).toHaveBeenCalledWith('Failed to invalidate cache for user kc-123', expect.any(Error))

        loggerSpy.mockRestore()
    })
})
