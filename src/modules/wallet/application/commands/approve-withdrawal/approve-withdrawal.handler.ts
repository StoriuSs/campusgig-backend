import { BadRequestException, Inject, NotFoundException } from '@nestjs/common'
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'

import {
    WALLET_REPOSITORY_PORT,
    WalletRepositoryPort,
    WithdrawalRequestItem
} from '../../../domain/ports/wallet.repository.port'
import { ADMIN_ACTIVITY_REPOSITORY_PORT, AdminActivityRepositoryPort } from '@/modules/admin-activity'
import { WithdrawalApprovedEvent } from '../../../domain/events'
import { ApproveWithdrawalCommand } from './approve-withdrawal.command'

@CommandHandler(ApproveWithdrawalCommand)
export class ApproveWithdrawalHandler implements ICommandHandler<ApproveWithdrawalCommand> {
    constructor(
        @Inject(WALLET_REPOSITORY_PORT) private readonly walletRepo: WalletRepositoryPort,
        @Inject(ADMIN_ACTIVITY_REPOSITORY_PORT) private readonly activityRepo: AdminActivityRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: ApproveWithdrawalCommand): Promise<WithdrawalRequestItem> {
        const request = await this.walletRepo.findWithdrawalById(command.withdrawalId)
        if (!request) {
            throw new NotFoundException('Withdrawal not found')
        }
        if (request.status !== 'Pending') {
            throw new BadRequestException('Withdrawal is not pending')
        }

        const updated = await this.walletRepo.approveWithdrawal(command.withdrawalId, command.adminId)
        const who = updated.user.displayName ?? updated.user.username ?? 'a user'
        await this.activityRepo.log({
            adminUserId: command.adminId,
            actionType: 'withdrawal_processed',
            targetType: 'withdrawal',
            targetId: updated.id,
            summary: `${updated.amountVnd.toLocaleString('vi-VN')}₫ to ${who} · Processed`,
            metadata: { amountVnd: updated.amountVnd, userId: updated.user.id }
        })
        this.eventBus.publish(
            new WithdrawalApprovedEvent(updated.user.id, updated.id, command.adminId, updated.amountVnd)
        )
        return updated
    }
}
