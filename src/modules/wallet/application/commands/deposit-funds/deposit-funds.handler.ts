import { BadRequestException, Inject } from '@nestjs/common'
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs'

import {
    WALLET_REPOSITORY_PORT,
    WalletRepositoryPort,
    DepositResult
} from '../../../domain/ports/wallet.repository.port'
import { DepositCompletedEvent } from '../../../domain/events'
import { DepositFundsCommand } from './deposit-funds.command'

@CommandHandler(DepositFundsCommand)
export class DepositFundsHandler implements ICommandHandler<DepositFundsCommand> {
    constructor(
        @Inject(WALLET_REPOSITORY_PORT) private readonly walletRepo: WalletRepositoryPort,
        private readonly eventBus: EventBus
    ) {}

    async execute(command: DepositFundsCommand): Promise<DepositResult> {
        if (!Number.isInteger(command.amountVnd) || command.amountVnd <= 0) {
            throw new BadRequestException('Amount must be greater than 0')
        }

        const result = await this.walletRepo.deposit(command.userId, command.amountVnd)
        this.eventBus.publish(new DepositCompletedEvent(command.userId, result.transaction.id, command.amountVnd))
        return result
    }
}
