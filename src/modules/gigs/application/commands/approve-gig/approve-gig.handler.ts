import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'
import { Inject } from '@nestjs/common'
import { ApproveGigCommand } from './approve-gig.command'
import {
    GigRepositoryPort,
    GIG_REPOSITORY_PORT,
    GigEntity,
    GigNotFoundException,
    GigNotPendingException
} from '@/modules/gigs/domain'
import { GigApprovedEvent } from '../../events/gig-approved.event'

@CommandHandler(ApproveGigCommand)
export class ApproveGigHandler implements ICommandHandler<ApproveGigCommand> {
    constructor(
        @Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: ApproveGigCommand): Promise<GigEntity> {
        const current = await this.gigRepo.findById(command.gigId)
        if (!current || current.isDeleted) {
            throw new GigNotFoundException(command.gigId)
        }
        if (current.status !== 'Pending') {
            throw new GigNotPendingException(command.gigId, current.status)
        }

        const approved = await this.gigRepo.approve(command.gigId)
        this.eventBus.publish(new GigApprovedEvent(approved.id, approved.sellerId))
        return approved
    }
}
