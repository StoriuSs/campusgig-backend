import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { UploadGigImageCommand } from './upload-gig-image.command'
import { GigRepositoryPort, GIG_REPOSITORY_PORT, GigImageEntity } from '@/modules/gigs/domain'
import { GigStoragePort, GIG_STORAGE_PORT } from '../../ports/gig-storage.port'

export interface UploadGigImageResult {
    image: GigImageEntity
    presignedUrl: string
}

@CommandHandler(UploadGigImageCommand)
export class UploadGigImageHandler implements ICommandHandler<UploadGigImageCommand> {
    constructor(
        @Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort,
        @Inject(GIG_STORAGE_PORT) private readonly storage: GigStoragePort
    ) {}

    async execute(command: UploadGigImageCommand): Promise<UploadGigImageResult> {
        const stored = await this.storage.uploadGigImage(command.fileBuffer, command.originalName, command.uploaderId)

        const image = await this.gigRepo.createOrphanImage({
            imageKey: stored.key,
            width: stored.width,
            height: stored.height,
            uploaderId: command.uploaderId
        })

        const presignedUrl = await this.storage.getSignedReadUrl(image.imageKey)
        return { image, presignedUrl }
    }
}
