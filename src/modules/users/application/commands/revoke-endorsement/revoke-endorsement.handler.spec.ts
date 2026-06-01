import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { EventBus } from '@nestjs/cqrs'

import { USER_REPOSITORY_PORT, UserEntity, UserNotFoundException } from '@/modules/users/domain'
import { ADMIN_ACTIVITY_REPOSITORY_PORT } from '@/modules/admin-activity'
import { RevokeEndorsementHandler } from './revoke-endorsement.handler'
import { RevokeEndorsementCommand } from './revoke-endorsement.command'
import { EndorsementRevokedEvent } from '../../events/endorsement-revoked.event'

function makeUser(overrides: Partial<ConstructorParameters<typeof UserEntity>[0]> = {}): UserEntity {
    return new UserEntity({ id: 'u1', keycloakId: 'kc-1', displayName: 'Jane', ...overrides })
}

describe('RevokeEndorsementHandler', () => {
    let handler: RevokeEndorsementHandler
    let repo: { findById: jest.Mock; update: jest.Mock }
    let activity: { log: jest.Mock }
    let eventBus: { publish: jest.Mock }

    beforeEach(async () => {
        repo = { findById: jest.fn(), update: jest.fn() }
        activity = { log: jest.fn() }
        eventBus = { publish: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RevokeEndorsementHandler,
                { provide: USER_REPOSITORY_PORT, useValue: repo },
                { provide: ADMIN_ACTIVITY_REPOSITORY_PORT, useValue: activity },
                { provide: EventBus, useValue: eventBus }
            ]
        }).compile()

        handler = module.get(RevokeEndorsementHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('revokes an endorsed user, logs the action, and publishes the event', async () => {
        repo.findById.mockResolvedValue(makeUser({ endorsedAt: new Date(), endorsedBy: 'admin-1' }))
        repo.update.mockResolvedValue(makeUser())

        await handler.execute(new RevokeEndorsementCommand('u1', 'admin-2'))

        expect(repo.update).toHaveBeenCalledWith('u1', { endorsedAt: null, endorsedBy: null })
        expect(activity.log).toHaveBeenCalledWith(
            expect.objectContaining({ actionType: 'endorsement_revoked', targetType: 'user', targetId: 'u1' })
        )
        expect(eventBus.publish).toHaveBeenCalledWith(expect.any(EndorsementRevokedEvent))
    })

    it('throws when the user is not endorsed', async () => {
        repo.findById.mockResolvedValue(makeUser())

        await expect(handler.execute(new RevokeEndorsementCommand('u1', 'admin-2'))).rejects.toThrow(
            BadRequestException
        )
        expect(repo.update).not.toHaveBeenCalled()
    })

    it('throws UserNotFoundException when the user is missing', async () => {
        repo.findById.mockResolvedValue(null)
        await expect(handler.execute(new RevokeEndorsementCommand('missing', 'admin-2'))).rejects.toThrow(
            UserNotFoundException
        )
    })
})
