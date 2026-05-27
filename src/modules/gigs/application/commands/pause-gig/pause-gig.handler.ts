import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { PauseGigCommand } from './pause-gig.command'
import {
    GigRepositoryPort,
    GIG_REPOSITORY_PORT,
    GigEntity,
    GigNotFoundException,
    InvalidGigStatusTransitionException
} from '@/modules/gigs/domain'

@CommandHandler(PauseGigCommand)
export class PauseGigHandler implements ICommandHandler<PauseGigCommand> {
    constructor(@Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort) {}

    async execute(command: PauseGigCommand): Promise<GigEntity> {
        const current = await this.gigRepo.findById(command.gigId)
        if (!current || current.sellerId !== command.callerId) {
            throw new GigNotFoundException(command.gigId)
        }
        if (current.status !== 'Active') {
            throw new InvalidGigStatusTransitionException(current.status, 'Paused')
        }
        return this.gigRepo.pause(command.gigId)
    }
}
