import type { WithdrawalSort } from '../../../domain/ports/wallet.repository.port'

export class ListPendingWithdrawalsAdminQuery {
    constructor(
        public readonly sort: WithdrawalSort,
        public readonly q: string | undefined,
        public readonly page: number,
        public readonly pageSize: number
    ) {}
}
