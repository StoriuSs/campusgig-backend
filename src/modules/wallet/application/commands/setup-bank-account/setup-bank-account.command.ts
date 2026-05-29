import type { BankAccountInput } from '../../../domain/ports/wallet.repository.port'

export class SetupBankAccountCommand {
    constructor(
        public readonly userId: string,
        public readonly bank: BankAccountInput
    ) {}
}
