import { Test, TestingModule } from '@nestjs/testing'

import { NOTIFICATION_REPOSITORY_PORT } from '../../../domain/ports/notification.repository.port'
import { MarkReadHandler } from './mark-read.handler'
import { MarkReadCommand } from './mark-read.command'

describe('MarkReadHandler', () => {
    let handler: MarkReadHandler
    let repo: { markRead: jest.Mock }

    beforeEach(async () => {
        repo = { markRead: jest.fn().mockResolvedValue(undefined) }
        const module: TestingModule = await Test.createTestingModule({
            providers: [MarkReadHandler, { provide: NOTIFICATION_REPOSITORY_PORT, useValue: repo }]
        }).compile()
        handler = module.get(MarkReadHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('marks a notification read scoped to the recipient (ownership guard)', async () => {
        await handler.execute(new MarkReadCommand('n1', 'u1'))
        expect(repo.markRead).toHaveBeenCalledWith('n1', 'u1')
    })
})
