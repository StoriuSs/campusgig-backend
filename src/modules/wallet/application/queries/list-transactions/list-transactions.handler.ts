import { Inject } from '@nestjs/common'
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'

import {
    WALLET_REPOSITORY_PORT,
    WalletRepositoryPort,
    ListTransactionsResult
} from '../../../domain/ports/wallet.repository.port'
import { ListTransactionsQuery } from './list-transactions.query'

@QueryHandler(ListTransactionsQuery)
export class ListTransactionsHandler implements IQueryHandler<ListTransactionsQuery> {
    constructor(@Inject(WALLET_REPOSITORY_PORT) private readonly walletRepo: WalletRepositoryPort) {}

    async execute(query: ListTransactionsQuery): Promise<ListTransactionsResult> {
        return this.walletRepo.listTransactions(query.userId, {
            type: query.type,
            page: query.page,
            pageSize: query.pageSize
        })
    }
}
