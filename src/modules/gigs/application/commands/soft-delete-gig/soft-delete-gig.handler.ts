import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { SoftDeleteGigCommand } from './soft-delete-gig.command'
import {
    GigRepositoryPort,
    GIG_REPOSITORY_PORT,
    GigNotFoundException,
    GigLockedForReviewException
} from '@/modules/gigs/domain'

@CommandHandler(SoftDeleteGigCommand)
export class SoftDeleteGigHandler implements ICommandHandler<SoftDeleteGigCommand> {
    constructor(@Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort) {}

    async execute(command: SoftDeleteGigCommand): Promise<void> {
        const current = await this.gigRepo.findById(command.gigId)
        if (!current || current.sellerId !== command.callerId) {
            throw new GigNotFoundException(command.gigId)
        }
        if (current.status === 'Deleted') {
            return
        }
        // Locked during admin review — no mutations while Pending.
        if (current.status === 'Pending') {
            throw new GigLockedForReviewException(command.gigId)
        }
        await this.gigRepo.softDelete(command.gigId, command.callerId)
    }
}
