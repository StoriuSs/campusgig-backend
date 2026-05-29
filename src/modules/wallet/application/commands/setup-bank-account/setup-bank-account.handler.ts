import { BadRequestException, Inject } from '@nestjs/common'
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs'

import { WALLET_REPOSITORY_PORT, WalletRepositoryPort } from '../../../domain/ports/wallet.repository.port'
import { SetupBankAccountCommand } from './setup-bank-account.command'

@CommandHandler(SetupBankAccountCommand)
export class SetupBankAccountHandler implements ICommandHandler<SetupBankAccountCommand> {
    constructor(@Inject(WALLET_REPOSITORY_PORT) private readonly walletRepo: WalletRepositoryPort) {}

    async execute(command: SetupBankAccountCommand): Promise<void> {
        const pending = await this.walletRepo.hasPendingWithdrawal(command.userId)
        if (pending) {
            throw new BadRequestException("You can't change bank details while a withdrawal is pending review.")
        }
        await this.walletRepo.setupBankAccount(command.userId, command.bank)
    }
}
