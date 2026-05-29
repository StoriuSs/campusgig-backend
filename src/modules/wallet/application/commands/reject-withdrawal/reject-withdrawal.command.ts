import type { WithdrawalRejectionReason } from '../../../domain/ports/wallet.repository.port'

export class RejectWithdrawalCommand {
    constructor(
        public readonly withdrawalId: string,
        public readonly adminId: string,
        public readonly reason: WithdrawalRejectionReason,
        public readonly note: string
    ) {}
}
