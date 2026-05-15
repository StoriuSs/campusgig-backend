import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { EnqueueKeycloakDeleteHandler } from './enqueue-keycloak-delete.handler'
import { AccountDeletedEvent } from '../account-deleted.event'

describe('EnqueueKeycloakDeleteHandler', () => {
    let handler: EnqueueKeycloakDeleteHandler
    let mockQueue: { add: jest.Mock }

    beforeEach(async () => {
        mockQueue = {
            add: jest.fn()
        }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EnqueueKeycloakDeleteHandler,
                {
                    provide: getQueueToken('keycloak-sync'),
                    useValue: mockQueue
                }
            ]
        }).compile()

        handler = module.get<EnqueueKeycloakDeleteHandler>(EnqueueKeycloakDeleteHandler)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('should enqueue a job to hard delete the user from Keycloak', async () => {
        const event = new AccountDeletedEvent('user-123', 'kc-123')

        await handler.handle(event)

        expect(mockQueue.add).toHaveBeenCalledWith(
            'hard-delete',
            { keycloakId: 'kc-123', dbId: 'user-123' },
            expect.objectContaining({
                attempts: 5,
                removeOnComplete: true
            })
        )
    })

    it('should catch errors and log them without throwing (fire and forget)', async () => {
        const event = new AccountDeletedEvent('user-123', 'kc-123')

        mockQueue.add.mockRejectedValue(new Error('Redis connection lost'))

        // We use spyOn just to suppress console errors during test run
        const loggerSpy = jest
            .spyOn((handler as unknown as { logger: { error: jest.Mock } }).logger, 'error')
            .mockImplementation()

        await expect(handler.handle(event)).resolves.not.toThrow()

        expect(loggerSpy).toHaveBeenCalledWith(
            'Failed to enqueue Keycloak hard delete for user kc-123',
            expect.any(Error)
        )

        loggerSpy.mockRestore()
    })
})
