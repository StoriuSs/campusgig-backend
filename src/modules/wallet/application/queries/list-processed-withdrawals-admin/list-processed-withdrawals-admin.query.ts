import type { WithdrawalSort } from '../../../domain/ports/wallet.repository.port'

export class ListProcessedWithdrawalsAdminQuery {
    constructor(
        public readonly status: 'completed' | 'rejected',
        public readonly sort: WithdrawalSort,
        public readonly q: string | undefined,
        public readonly page: number,
        public readonly pageSize: number
    ) {}
}
