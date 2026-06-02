import { Test, TestingModule } from '@nestjs/testing'

import { NOTIFICATION_REPOSITORY_PORT } from '../../../domain/ports/notification.repository.port'
import { ListNotificationsHandler } from './list-notifications.handler'
import { ListNotificationsQuery } from './list-notifications.query'

describe('ListNotificationsHandler', () => {
    let handler: ListNotificationsHandler
    let repo: { list: jest.Mock }

    beforeEach(async () => {
        repo = { list: jest.fn().mockResolvedValue({ items: [], total: 0 }) }
        const module: TestingModule = await Test.createTestingModule({
            providers: [ListNotificationsHandler, { provide: NOTIFICATION_REPOSITORY_PORT, useValue: repo }]
        }).compile()
        handler = module.get(ListNotificationsHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('forwards recipient, filter, and pagination to the repo', async () => {
        await handler.execute(new ListNotificationsQuery('u1', 'unread', 2, 10))
        expect(repo.list).toHaveBeenCalledWith('u1', 'unread', 2, 10)
    })
})
