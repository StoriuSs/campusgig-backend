import { Inject } from '@nestjs/common'
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs'

import { ORDERS_REPOSITORY_PORT, OrdersRepositoryPort } from '@/modules/orders/domain/ports'
import { ADMIN_ACTIVITY_REPOSITORY_PORT, AdminActivityRepositoryPort } from '@/modules/admin-activity'
import { formatOrderCode } from '@/shared/utils'

import { DISPUTES_REPOSITORY_PORT, DisputesRepositoryPort } from '../../../domain/ports/disputes.repository.port'
import { DisputeResolvedEvent } from '../../../domain/events'
import { ResolveDisputeCommand } from './resolve-dispute.command'

const VERDICT_LABEL: Record<string, string> = {
    RefundBuyer: 'Refund buyer',
    CompleteForSeller: 'Complete for seller',
    SplitFunds: 'Split funds'
}

@CommandHandler(ResolveDisputeCommand)
export class ResolveDisputeHandler implements ICommandHandler<ResolveDisputeCommand> {
    constructor(
        @Inject(DISPUTES_REPOSITORY_PORT) private readonly repo: DisputesRepositoryPort,
        @Inject(ORDERS_REPOSITORY_PORT) private readonly ordersRepo: OrdersRepositoryPort,
        @Inject(ADMIN_ACTIVITY_REPOSITORY_PORT) private readonly activityRepo: AdminActivityRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: ResolveDisputeCommand): Promise<void> {
        const result = await this.repo.resolve(command.orderId, command.adminId, {
            verdict: command.verdict,
            buyerRefundPercent: command.buyerRefundPercent,
            adminNotes: command.adminNotes
        })
        // Admin isn't a participant — read OrderDetail as the filer (always a participant).
        const order = await this.ordersRepo.findByIdForViewer(result.orderId, result.dispute.filedByUserId)
        await this.activityRepo.log({
            adminUserId: command.adminId,
            actionType: 'dispute_resolved',
            targetType: 'order',
            targetId: command.orderId,
            summary: `${order ? formatOrderCode(order.number) : command.orderId} · ${VERDICT_LABEL[command.verdict] ?? command.verdict}`,
            metadata: { verdict: command.verdict, buyerRefundPercent: command.buyerRefundPercent ?? null }
        })
        if (order) this.eventBus.publish(new DisputeResolvedEvent(order, result.dispute, result.refs))
    }
}
