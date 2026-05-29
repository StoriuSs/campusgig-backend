import { Inject } from '@nestjs/common'
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'

import {
    WALLET_REPOSITORY_PORT,
    WalletRepositoryPort,
    ListWithdrawalsResult
} from '../../../domain/ports/wallet.repository.port'
import { ListPendingWithdrawalsAdminQuery } from './list-pending-withdrawals-admin.query'

export interface AdminWithdrawalsListWithSummary extends ListWithdrawalsResult {
    summary: { pendingCount: number; processedThisMonthCount: number }
}

@QueryHandler(ListPendingWithdrawalsAdminQuery)
export class ListPendingWithdrawalsAdminHandler implements IQueryHandler<ListPendingWithdrawalsAdminQuery> {
    constructor(@Inject(WALLET_REPOSITORY_PORT) private readonly walletRepo: WalletRepositoryPort) {}

    async execute(query: ListPendingWithdrawalsAdminQuery): Promise<AdminWithdrawalsListWithSummary> {
        const [list, pendingCount, processedThisMonthCount] = await Promise.all([
            this.walletRepo.listWithdrawalRequests({
                status: 'pending',
                sort: query.sort,
                q: query.q,
                page: query.page,
                pageSize: query.pageSize
            }),
            this.walletRepo.countPending(),
            this.walletRepo.countProcessedThisMonth()
        ])
        return { ...list, summary: { pendingCount, processedThisMonthCount } }
    }
}
