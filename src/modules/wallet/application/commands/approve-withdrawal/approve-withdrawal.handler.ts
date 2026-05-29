import { BadRequestException, Inject, NotFoundException } from '@nestjs/common'
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'

import {
    WALLET_REPOSITORY_PORT,
    WalletRepositoryPort,
    WithdrawalRequestItem
} from '../../../domain/ports/wallet.repository.port'
import { WithdrawalApprovedEvent } from '../../../domain/events'
import { ApproveWithdrawalCommand } from './approve-withdrawal.command'

@CommandHandler(ApproveWithdrawalCommand)
export class ApproveWithdrawalHandler implements ICommandHandler<ApproveWithdrawalCommand> {
    constructor(
        @Inject(WALLET_REPOSITORY_PORT) private readonly walletRepo: WalletRepositoryPort,
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
        this.eventBus.publish(
            new WithdrawalApprovedEvent(updated.user.id, updated.id, command.adminId, updated.amountVnd)
        )
        return updated
    }
}
