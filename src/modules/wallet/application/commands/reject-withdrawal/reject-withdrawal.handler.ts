import { BadRequestException, Inject, NotFoundException } from '@nestjs/common'
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'

import {
    WALLET_REPOSITORY_PORT,
    WalletRepositoryPort,
    WithdrawalRejectionReason,
    WithdrawalRequestItem
} from '../../../domain/ports/wallet.repository.port'
import { ADMIN_ACTIVITY_REPOSITORY_PORT, AdminActivityRepositoryPort } from '@/modules/admin-activity'
import { WithdrawalRejectedEvent } from '../../../domain/events'
import { RejectWithdrawalCommand } from './reject-withdrawal.command'

const ALLOWED_REASONS: WithdrawalRejectionReason[] = [
    'InvalidAccount',
    'SuspiciousActivity',
    'InsufficientDocumentation',
    'PolicyViolation',
    'Other'
]
const MAX_NOTE_LEN = 500

@CommandHandler(RejectWithdrawalCommand)
export class RejectWithdrawalHandler implements ICommandHandler<RejectWithdrawalCommand> {
    constructor(
        @Inject(WALLET_REPOSITORY_PORT) private readonly walletRepo: WalletRepositoryPort,
        @Inject(ADMIN_ACTIVITY_REPOSITORY_PORT) private readonly activityRepo: AdminActivityRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: RejectWithdrawalCommand): Promise<WithdrawalRequestItem> {
        if (!ALLOWED_REASONS.includes(command.reason)) {
            throw new BadRequestException('Invalid rejection reason')
        }
        const trimmed = command.note?.trim() ?? ''
        if (trimmed.length === 0) {
            throw new BadRequestException('Note to user is required')
        }
        if (trimmed.length > MAX_NOTE_LEN) {
            throw new BadRequestException(`Note must be at most ${MAX_NOTE_LEN} characters`)
        }

        const request = await this.walletRepo.findWithdrawalById(command.withdrawalId)
        if (!request) {
            throw new NotFoundException('Withdrawal not found')
        }
        if (request.status !== 'Pending') {
            throw new BadRequestException('Withdrawal is not pending')
        }

        const updated = await this.walletRepo.rejectWithdrawal(
            command.withdrawalId,
            command.adminId,
            command.reason,
            trimmed
        )
        const who = updated.user.displayName ?? updated.user.username ?? 'a user'
        await this.activityRepo.log({
            adminUserId: command.adminId,
            actionType: 'withdrawal_rejected',
            targetType: 'withdrawal',
            targetId: updated.id,
            summary: `${updated.amountVnd.toLocaleString('vi-VN')}₫ to ${who} · Rejected`,
            metadata: { amountVnd: updated.amountVnd, userId: updated.user.id, reason: command.reason }
        })
        this.eventBus.publish(
            new WithdrawalRejectedEvent(
                updated.user.id,
                updated.id,
                command.adminId,
                updated.amountVnd,
                command.reason,
                trimmed
            )
        )
        return updated
    }
}
