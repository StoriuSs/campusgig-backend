import type { WithdrawalRejectionReason } from '../ports/wallet.repository.port'

export class WithdrawalRejectedEvent {
    constructor(
        public readonly userId: string,
        public readonly withdrawalRequestId: string,
        public readonly adminId: string,
        public readonly amountVnd: number,
        public readonly reason: WithdrawalRejectionReason,
        public readonly note: string
    ) {}
}
