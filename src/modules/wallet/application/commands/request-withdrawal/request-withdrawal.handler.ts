import { BadRequestException, Inject } from '@nestjs/common'
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'

import {
    WALLET_REPOSITORY_PORT,
    WalletRepositoryPort,
    RequestWithdrawalResult
} from '../../../domain/ports/wallet.repository.port'
import { WithdrawalRequestedEvent } from '../../../domain/events'
import { RequestWithdrawalCommand } from './request-withdrawal.command'

const MIN_WITHDRAWAL_VND = 50_000

@CommandHandler(RequestWithdrawalCommand)
export class RequestWithdrawalHandler implements ICommandHandler<RequestWithdrawalCommand> {
    constructor(
        @Inject(WALLET_REPOSITORY_PORT) private readonly walletRepo: WalletRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: RequestWithdrawalCommand): Promise<RequestWithdrawalResult> {
        if (!Number.isInteger(command.amountVnd) || command.amountVnd < MIN_WITHDRAWAL_VND) {
            throw new BadRequestException(`Minimum withdrawal is ${MIN_WITHDRAWAL_VND.toLocaleString('vi-VN')}₫`)
        }

        const balance = await this.walletRepo.getBalance(command.userId)

        if (command.amountVnd > balance.walletBalance) {
            throw new BadRequestException(
                `Insufficient balance. You have ${balance.walletBalance.toLocaleString('vi-VN')}₫ available.`
            )
        }

        // First-time setup path: caller provides bankAccountSetup if user has no bank on file.
        if (!balance.hasBankAccount) {
            if (!command.bankAccountSetup) {
                throw new BadRequestException('Bank account is required')
            }
            await this.walletRepo.setupBankAccount(command.userId, command.bankAccountSetup)
        }

        const result = await this.walletRepo.requestWithdrawal(command.userId, command.amountVnd)
        this.eventBus.publish(new WithdrawalRequestedEvent(command.userId, result.request.id, command.amountVnd))
        return result
    }
}
