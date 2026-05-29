import type { BankAccountInput } from '../../../domain/ports/wallet.repository.port'

export class RequestWithdrawalCommand {
    constructor(
        public readonly userId: string,
        public readonly amountVnd: number,
        // Provided only on first withdrawal — handler will call SetupBankAccount.
        public readonly bankAccountSetup?: BankAccountInput
    ) {}
}
