import { Test, TestingModule } from '@nestjs/testing'
import { CommandBus } from '@nestjs/cqrs'

import { GigApprovedEvent } from '@/modules/gigs/application/events/gig-approved.event'
import { GigSubmittedEvent } from '@/modules/gigs/application/events/gig-submitted.event'

import { NOTIFICATION_REPOSITORY_PORT } from '../../../domain/ports/notification.repository.port'
import { GigNotificationsHandler } from './gig-notifications.handler'
import { CreateNotificationCommand } from '../../create-notification/create-notification.command'

describe('GigNotificationsHandler', () => {
    let handler: GigNotificationsHandler
    let bus: { execute: jest.Mock }
    let repo: { findAdminIds: jest.Mock; findDisplayName: jest.Mock }

    beforeEach(async () => {
        bus = { execute: jest.fn() }
        repo = {
            findAdminIds: jest.fn().mockResolvedValue(['admin-1']),
            findDisplayName: jest.fn().mockResolvedValue('Sarah J.')
        }
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GigNotificationsHandler,
                { provide: CommandBus, useValue: bus },
                { provide: NOTIFICATION_REPOSITORY_PORT, useValue: repo }
            ]
        }).compile()
        handler = module.get(GigNotificationsHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('notifies the seller when their gig is approved', async () => {
        await handler.handle(new GigApprovedEvent('g1', 'seller-1', 'Logo Design'))

        const cmd = bus.execute.mock.calls[0][0] as CreateNotificationCommand
        expect(cmd).toMatchObject({ recipientIds: ['seller-1'], type: 'gig_approved' })
        expect(cmd.data).toMatchObject({ gigId: 'g1', gigTitle: 'Logo Design' })
    })

    it('fans out to admins when a gig is submitted for review', async () => {
        await handler.handle(new GigSubmittedEvent('g2', 'seller-1', 'Python Tutoring'))

        const cmd = bus.execute.mock.calls[0][0] as CreateNotificationCommand
        expect(cmd).toMatchObject({ recipientIds: ['admin-1'], type: 'admin_gig_pending' })
        expect(cmd.data).toMatchObject({ gigTitle: 'Python Tutoring', sellerName: 'Sarah J.' })
    })
})
