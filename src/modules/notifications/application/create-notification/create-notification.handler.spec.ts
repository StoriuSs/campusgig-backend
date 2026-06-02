import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'

// Stub the messaging barrel so importing SocketEmitter (a DI token here) doesn't
// drag the WS gateway + its ESM auth deps into jest's transform.
jest.mock('@/modules/messaging/application/events/handlers', () => ({ SocketEmitter: class SocketEmitter {} }))

import { SocketEmitter } from '@/modules/messaging/application/events/handlers'

import { NOTIFICATION_REPOSITORY_PORT } from '../../domain/ports/notification.repository.port'
import { NOTIFICATION_EMAIL_QUEUE } from '../email/notification-email.queue'
import { CreateNotificationHandler } from './create-notification.handler'
import { CreateNotificationCommand } from './create-notification.command'

describe('CreateNotificationHandler', () => {
    let handler: CreateNotificationHandler
    let repo: { create: jest.Mock; unreadCount: jest.Mock }
    let emitter: { emitToUser: jest.Mock }
    let queue: { add: jest.Mock }

    beforeEach(async () => {
        repo = {
            create: jest
                .fn()
                .mockImplementation(({ recipientId, type, data }) =>
                    Promise.resolve({
                        id: 'n1',
                        recipientId,
                        type,
                        data,
                        readAt: null,
                        emailSent: false,
                        createdAt: new Date()
                    })
                ),
            unreadCount: jest.fn().mockResolvedValue(3)
        }
        emitter = { emitToUser: jest.fn() }
        queue = { add: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CreateNotificationHandler,
                { provide: NOTIFICATION_REPOSITORY_PORT, useValue: repo },
                { provide: SocketEmitter, useValue: emitter },
                { provide: getQueueToken(NOTIFICATION_EMAIL_QUEUE), useValue: queue }
            ]
        }).compile()

        handler = module.get(CreateNotificationHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('persists, emits a live socket event, and enqueues email for a flagged type', async () => {
        await handler.execute(new CreateNotificationCommand(['u1'], 'order_placed', { orderCode: 'CG-1' }))

        expect(repo.create).toHaveBeenCalledWith({
            recipientId: 'u1',
            type: 'order_placed',
            data: { orderCode: 'CG-1' }
        })
        expect(emitter.emitToUser).toHaveBeenCalledWith(
            'u1',
            'notification:new',
            expect.objectContaining({ unreadCount: 3, notification: expect.objectContaining({ type: 'order_placed' }) })
        )
        expect(queue.add).toHaveBeenCalledTimes(1)
    })

    it('does NOT enqueue email for a non-flagged type', async () => {
        await handler.execute(new CreateNotificationCommand(['u1'], 'order_accepted', { orderCode: 'CG-1' }))

        expect(repo.create).toHaveBeenCalled()
        expect(emitter.emitToUser).toHaveBeenCalled()
        expect(queue.add).not.toHaveBeenCalled()
    })

    it('fans out to every recipient (one row + one emit each)', async () => {
        await handler.execute(new CreateNotificationCommand(['a', 'b', 'c'], 'admin_gig_pending', { gigTitle: 'X' }))

        expect(repo.create).toHaveBeenCalledTimes(3)
        expect(emitter.emitToUser).toHaveBeenCalledTimes(3)
        expect(queue.add).not.toHaveBeenCalled()
    })
})
