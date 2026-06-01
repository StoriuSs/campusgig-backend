import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { BadRequestException, Inject } from '@nestjs/common'

import { UserRepositoryPort, USER_REPOSITORY_PORT, UserNotFoundException, UserEntity } from '@/modules/users/domain'
import { SaveAdminNoteCommand } from './save-admin-note.command'

const MAX_NOTE_LEN = 2000

@CommandHandler(SaveAdminNoteCommand)
export class SaveAdminNoteHandler implements ICommandHandler<SaveAdminNoteCommand> {
    constructor(@Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort) {}

    async execute(command: SaveAdminNoteCommand): Promise<UserEntity> {
        const trimmed = command.note?.trim() || null
        if (trimmed !== null && trimmed.length > MAX_NOTE_LEN) {
            throw new BadRequestException(`Admin note must be at most ${MAX_NOTE_LEN} characters.`)
        }
        const user = await this.userRepo.findById(command.userId)
        if (!user || user.isDeleted) {
            throw new UserNotFoundException(command.userId)
        }
        return this.userRepo.update(command.userId, { adminNote: trimmed })
    }
}
