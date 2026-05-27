import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject, BadRequestException } from '@nestjs/common'
import { ReorderGigImagesCommand } from './reorder-gig-images.command'
import { GigRepositoryPort, GIG_REPOSITORY_PORT, GigNotFoundException } from '@/modules/gigs/domain'

@CommandHandler(ReorderGigImagesCommand)
export class ReorderGigImagesHandler implements ICommandHandler<ReorderGigImagesCommand> {
    constructor(@Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort) {}

    async execute(command: ReorderGigImagesCommand): Promise<void> {
        const gig = await this.gigRepo.findById(command.gigId)
        if (!gig || gig.sellerId !== command.callerId) {
            throw new GigNotFoundException(command.gigId)
        }
        if (command.imageIds.length === 0) {
            throw new BadRequestException('imageIds cannot be empty.')
        }
        // Duplicates check
        const seen = new Set<string>()
        for (const id of command.imageIds) {
            if (seen.has(id)) {
                throw new BadRequestException(`Duplicate image id in reorder: ${id}`)
            }
            seen.add(id)
        }
        await this.gigRepo.reorderImages(command.gigId, command.imageIds)
    }
}
