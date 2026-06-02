import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'
import { Inject, BadRequestException } from '@nestjs/common'
import { RejectGigCommand } from './reject-gig.command'
import {
    GigRepositoryPort,
    GIG_REPOSITORY_PORT,
    GigEntity,
    GigNotFoundException,
    GigNotPendingException,
    isRejectionCategory
} from '@/modules/gigs/domain'
import { ADMIN_ACTIVITY_REPOSITORY_PORT, AdminActivityRepositoryPort } from '@/modules/admin-activity'
import { GigRejectedEvent } from '../../events/gig-rejected.event'

const REASON_MIN = 20
const REASON_MAX = 1000

@CommandHandler(RejectGigCommand)
export class RejectGigHandler implements ICommandHandler<RejectGigCommand> {
    constructor(
        @Inject(GIG_REPOSITORY_PORT) private readonly gigRepo: GigRepositoryPort,
        @Inject(ADMIN_ACTIVITY_REPOSITORY_PORT) private readonly activityRepo: AdminActivityRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: RejectGigCommand): Promise<GigEntity> {
        if (!isRejectionCategory(command.rejectionCategory)) {
            throw new BadRequestException('Invalid rejection category.')
        }
        const reason = command.rejectionReason?.trim() ?? ''
        if (reason.length < REASON_MIN || reason.length > REASON_MAX) {
            throw new BadRequestException(
                `Rejection reason must be between ${REASON_MIN} and ${REASON_MAX} characters.`
            )
        }

        const current = await this.gigRepo.findById(command.gigId)
        if (!current || current.isDeleted) {
            throw new GigNotFoundException(command.gigId)
        }
        if (current.status !== 'Pending') {
            throw new GigNotPendingException(command.gigId, current.status)
        }

        const rejected = await this.gigRepo.reject(command.gigId, command.rejectionCategory, reason)
        await this.activityRepo.log({
            adminUserId: command.adminId,
            actionType: 'gig_rejected',
            targetType: 'gig',
            targetId: rejected.id,
            summary: `"${rejected.title}"`,
            metadata: { sellerId: rejected.sellerId, category: command.rejectionCategory, reason }
        })
        this.eventBus.publish(
            new GigRejectedEvent(rejected.id, rejected.sellerId, command.rejectionCategory, reason, rejected.title)
        )
        return rejected
    }
}
