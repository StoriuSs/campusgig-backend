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
import { ADMIN_ACTIVITY_REPOSITORY_PORT, AdminActivityRepositoryPort } from '@/modules/admin-activity'
import { GigApprovedEvent } from '../../events/gig-approved.event'

@CommandHandler(ApproveGigCommand)
export class ApproveGigHandler implements ICommandHandler<ApproveGigCommand> {
    constructor(
        @Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort,
        @Inject(ADMIN_ACTIVITY_REPOSITORY_PORT) private readonly activityRepo: AdminActivityRepositoryPort,
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
        await this.activityRepo.log({
            adminUserId: command.adminId,
            actionType: 'gig_approved',
            targetType: 'gig',
            targetId: approved.id,
            summary: `"${approved.title}"`,
            metadata: { sellerId: approved.sellerId }
        })
        this.eventBus.publish(new GigApprovedEvent(approved.id, approved.sellerId))
        return approved
    }
}
