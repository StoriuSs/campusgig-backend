import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { ResumeGigCommand } from './resume-gig.command'
import {
    GigRepositoryPort,
    GIG_REPOSITORY_PORT,
    GigEntity,
    GigNotFoundException,
    InvalidGigStatusTransitionException
} from '@/modules/gigs/domain'

@CommandHandler(ResumeGigCommand)
export class ResumeGigHandler implements ICommandHandler<ResumeGigCommand> {
    constructor(@Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort) {}

    async execute(command: ResumeGigCommand): Promise<GigEntity> {
        const current = await this.gigRepo.findById(command.gigId)
        if (!current || current.sellerId !== command.callerId) {
            throw new GigNotFoundException(command.gigId)
        }
        if (current.status !== 'Paused') {
            throw new InvalidGigStatusTransitionException(current.status, 'Active')
        }
        return this.gigRepo.resume(command.gigId)
    }
}
