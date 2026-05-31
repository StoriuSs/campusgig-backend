import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { UploadAvatarCommand } from './upload-avatar.command'
import { UserRepositoryPort, USER_REPOSITORY_PORT } from '@/modules/users/domain'
import { StoragePort, STORAGE_PORT, UploadedFileResult } from '../../ports'
import { AvatarUploadedEvent } from '../../events/avatar-uploaded.event'
import { UserProfileUpdatedEvent } from '../../events/user-profile-updated.event'
import { UserEntity } from '@/modules/users/domain'

export interface UploadAvatarResult {
    user: UserEntity
    upload: UploadedFileResult
}

@CommandHandler(UploadAvatarCommand)
export class UploadAvatarHandler implements ICommandHandler<UploadAvatarCommand> {
    constructor(
        @Inject(USER_REPOSITORY_PORT) private readonly userRepo: UserRepositoryPort,
        @Inject(STORAGE_PORT) private readonly storage: StoragePort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: UploadAvatarCommand): Promise<UploadAvatarResult> {
        const [currentAvatarUrl, uploadedFile] = await Promise.all([
            this.userRepo.findAvatarUrl(command.userId),
            this.storage.uploadAvatar(command.fileBuffer, command.originalName, command.userId)
        ])

        const user = await this.userRepo.update(command.userId, { avatarUrl: uploadedFile.key })

        // AvatarUploadedEvent triggers old-file S3 cleanup via CleanupOldAvatarHandler.
        if (currentAvatarUrl) {
            this.eventBus.publish(new AvatarUploadedEvent(user.id, currentAvatarUrl))
        }
        this.eventBus.publish(new UserProfileUpdatedEvent(user.id, user.keycloakId))

        return { user, upload: uploadedFile }
    }
}
