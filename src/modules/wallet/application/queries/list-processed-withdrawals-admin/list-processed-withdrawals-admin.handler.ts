import { Inject } from '@nestjs/common'
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'

import { WALLET_REPOSITORY_PORT, WalletRepositoryPort } from '../../../domain/ports/wallet.repository.port'
import { ListProcessedWithdrawalsAdminQuery } from './list-processed-withdrawals-admin.query'
import { AdminWithdrawalsListWithSummary } from '../list-pending-withdrawals-admin/list-pending-withdrawals-admin.handler'

@QueryHandler(ListProcessedWithdrawalsAdminQuery)
export class ListProcessedWithdrawalsAdminHandler implements IQueryHandler<ListProcessedWithdrawalsAdminQuery> {
    constructor(@Inject(WALLET_REPOSITORY_PORT) private readonly walletRepo: WalletRepositoryPort) {}

    async execute(query: ListProcessedWithdrawalsAdminQuery): Promise<AdminWithdrawalsListWithSummary> {
        const [list, pendingCount, processedThisMonthCount] = await Promise.all([
            this.walletRepo.listWithdrawalRequests({
                status: query.status,
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
