import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { DeleteGigImageCommand } from './delete-gig-image.command'
import { GigRepositoryPort, GIG_REPOSITORY_PORT, ImageNotOwnedException } from '@/modules/gigs/domain'
import { GigStoragePort, GIG_STORAGE_PORT } from '../../ports/gig-storage.port'

@CommandHandler(DeleteGigImageCommand)
export class DeleteGigImageHandler implements ICommandHandler<DeleteGigImageCommand> {
    constructor(
        @Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort,
        @Inject(GIG_STORAGE_PORT) private readonly storage: GigStoragePort
    ) {}

    async execute(command: DeleteGigImageCommand): Promise<void> {
        const image = await this.gigRepo.findImageById(command.imageId)
        if (!image) {
            throw new ImageNotOwnedException(command.imageId)
        }

        if (image.isOrphan) {
            if (image.uploaderId !== command.callerId) {
                throw new ImageNotOwnedException(command.imageId)
            }
        } else {
            const gig = await this.gigRepo.findById(image.gigId!)
            if (!gig || gig.sellerId !== command.callerId) {
                throw new ImageNotOwnedException(command.imageId)
            }
        }

        // Storage-first: if DB delete fails, the cleanup job will reclaim the orphan S3 object.
        try {
            await this.storage.deleteFile(image.imageKey)
        } catch {
            // Ignore storage failures — we'd rather lose the S3 object than the DB row.
        }
        await this.gigRepo.deleteImage(command.imageId)
    }
}
