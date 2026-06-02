import { Test, TestingModule } from '@nestjs/testing'
import { CommandBus } from '@nestjs/cqrs'

import { DisputeFiledEvent, DisputeResolvedEvent } from '@/modules/disputes/domain/events'

import { NOTIFICATION_REPOSITORY_PORT } from '../../../domain/ports/notification.repository.port'
import { DisputeNotificationsHandler } from './dispute-notifications.handler'
import { CreateNotificationCommand } from '../../create-notification/create-notification.command'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const order: any = {
    id: 'o1',
    number: 8924,
    buyer: { id: 'buyer-1' },
    seller: { id: 'seller-1' }
}

describe('DisputeNotificationsHandler', () => {
    let handler: DisputeNotificationsHandler
    let bus: { execute: jest.Mock }
    let repo: { findAdminIds: jest.Mock }

    beforeEach(async () => {
        bus = { execute: jest.fn() }
        repo = { findAdminIds: jest.fn().mockResolvedValue(['admin-1', 'admin-2']) }
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DisputeNotificationsHandler,
                { provide: CommandBus, useValue: bus },
                { provide: NOTIFICATION_REPOSITORY_PORT, useValue: repo }
            ]
        }).compile()
        handler = module.get(DisputeNotificationsHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('notifies the non-filer party + fans out to every admin on dispute filed', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handler.handle(new DisputeFiledEvent(order, { filedByUserId: 'buyer-1' } as any))

        const cmds = bus.execute.mock.calls.map((c) => c[0] as CreateNotificationCommand)
        expect(cmds[0]).toMatchObject({ recipientIds: ['seller-1'], type: 'dispute_filed' })
        expect(cmds[1]).toMatchObject({ recipientIds: ['admin-1', 'admin-2'], type: 'admin_dispute_filed' })
    })

    it('notifies both parties on dispute resolved', async () => {
        await handler.handle(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new DisputeResolvedEvent(order, { verdict: 'RefundBuyer' } as any, {} as any)
        )

        const cmd = bus.execute.mock.calls[0][0] as CreateNotificationCommand
        expect(cmd.recipientIds).toEqual(['buyer-1', 'seller-1'])
        expect(cmd.type).toBe('dispute_resolved')
        expect(cmd.data.verdict).toBe('RefundBuyer')
    })
})
