import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { EventBus } from '@nestjs/cqrs'

import { USER_REPOSITORY_PORT, UserEntity, UserNotFoundException } from '@/modules/users/domain'
import { ADMIN_ACTIVITY_REPOSITORY_PORT } from '@/modules/admin-activity'
import { EndorseUserHandler } from './endorse-user.handler'
import { EndorseUserCommand } from './endorse-user.command'
import { UserEndorsedEvent } from '../../events/user-endorsed.event'

function makeUser(overrides: Partial<ConstructorParameters<typeof UserEntity>[0]> = {}): UserEntity {
    return new UserEntity({ id: 'u1', keycloakId: 'kc-1', displayName: 'Jane', ...overrides })
}

describe('EndorseUserHandler', () => {
    let handler: EndorseUserHandler
    let repo: { findById: jest.Mock; update: jest.Mock }
    let activity: { log: jest.Mock }
    let eventBus: { publish: jest.Mock }

    beforeEach(async () => {
        repo = { findById: jest.fn(), update: jest.fn() }
        activity = { log: jest.fn() }
        eventBus = { publish: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EndorseUserHandler,
                { provide: USER_REPOSITORY_PORT, useValue: repo },
                { provide: ADMIN_ACTIVITY_REPOSITORY_PORT, useValue: activity },
                { provide: EventBus, useValue: eventBus }
            ]
        }).compile()

        handler = module.get(EndorseUserHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('endorses a non-endorsed user, logs the action, and publishes the event', async () => {
        repo.findById.mockResolvedValue(makeUser())
        repo.update.mockResolvedValue(makeUser({ endorsedAt: new Date(), endorsedBy: 'admin-1' }))

        await handler.execute(new EndorseUserCommand('u1', 'admin-1'))

        expect(repo.update).toHaveBeenCalledWith('u1', expect.objectContaining({ endorsedBy: 'admin-1' }))
        expect(activity.log).toHaveBeenCalledWith(
            expect.objectContaining({ actionType: 'user_endorsed', targetType: 'user', targetId: 'u1' })
        )
        expect(eventBus.publish).toHaveBeenCalledWith(expect.any(UserEndorsedEvent))
    })

    it('throws when the user is already endorsed', async () => {
        repo.findById.mockResolvedValue(makeUser({ endorsedAt: new Date() }))

        await expect(handler.execute(new EndorseUserCommand('u1', 'admin-1'))).rejects.toThrow(BadRequestException)
        expect(repo.update).not.toHaveBeenCalled()
    })

    it('throws UserNotFoundException when the user is missing or deleted', async () => {
        repo.findById.mockResolvedValue(null)
        await expect(handler.execute(new EndorseUserCommand('missing', 'admin-1'))).rejects.toThrow(
            UserNotFoundException
        )

        repo.findById.mockResolvedValue(makeUser({ deletedAt: new Date() }))
        await expect(handler.execute(new EndorseUserCommand('u1', 'admin-1'))).rejects.toThrow(UserNotFoundException)
    })
})
