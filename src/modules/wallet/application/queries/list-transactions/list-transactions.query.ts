import type { TransactionType } from '../../../domain/ports/wallet.repository.port'

export class ListTransactionsQuery {
    constructor(
        public readonly userId: string,
        public readonly type: TransactionType | 'all',
        public readonly page: number,
        public readonly pageSize: number
    ) {}
}
