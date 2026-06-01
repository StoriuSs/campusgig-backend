import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'

import { USER_REPOSITORY_PORT, UserEntity, UserNotFoundException } from '@/modules/users/domain'
import { SaveAdminNoteHandler } from './save-admin-note.handler'
import { SaveAdminNoteCommand } from './save-admin-note.command'

function makeUser(overrides: Partial<ConstructorParameters<typeof UserEntity>[0]> = {}): UserEntity {
    return new UserEntity({ id: 'u1', keycloakId: 'kc-1', ...overrides })
}

describe('SaveAdminNoteHandler', () => {
    let handler: SaveAdminNoteHandler
    let repo: { findById: jest.Mock; update: jest.Mock }

    beforeEach(async () => {
        repo = { findById: jest.fn(), update: jest.fn() }

        const module: TestingModule = await Test.createTestingModule({
            providers: [SaveAdminNoteHandler, { provide: USER_REPOSITORY_PORT, useValue: repo }]
        }).compile()

        handler = module.get(SaveAdminNoteHandler)
    })

    afterEach(() => jest.clearAllMocks())

    it('trims and persists the note', async () => {
        repo.findById.mockResolvedValue(makeUser())
        repo.update.mockResolvedValue(makeUser({ adminNote: 'watchlisted' }))

        await handler.execute(new SaveAdminNoteCommand('u1', 'admin-1', '  watchlisted  '))

        expect(repo.update).toHaveBeenCalledWith('u1', { adminNote: 'watchlisted' })
    })

    it('stores null for an empty / whitespace note', async () => {
        repo.findById.mockResolvedValue(makeUser())
        repo.update.mockResolvedValue(makeUser())

        await handler.execute(new SaveAdminNoteCommand('u1', 'admin-1', '   '))

        expect(repo.update).toHaveBeenCalledWith('u1', { adminNote: null })
    })

    it('rejects notes longer than 2000 chars', async () => {
        await expect(handler.execute(new SaveAdminNoteCommand('u1', 'admin-1', 'x'.repeat(2001)))).rejects.toThrow(
            BadRequestException
        )
        expect(repo.findById).not.toHaveBeenCalled()
    })

    it('throws UserNotFoundException when the user is missing', async () => {
        repo.findById.mockResolvedValue(null)
        await expect(handler.execute(new SaveAdminNoteCommand('missing', 'admin-1', 'note'))).rejects.toThrow(
            UserNotFoundException
        )
    })
})
