import { Inject, NotFoundException } from '@nestjs/common'
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'

import {
    WALLET_REPOSITORY_PORT,
    WalletRepositoryPort,
    WithdrawalRequestItem
} from '../../../domain/ports/wallet.repository.port'
import { GetWithdrawalDetailAdminQuery } from './get-withdrawal-detail-admin.query'

@QueryHandler(GetWithdrawalDetailAdminQuery)
export class GetWithdrawalDetailAdminHandler implements IQueryHandler<GetWithdrawalDetailAdminQuery> {
    constructor(@Inject(WALLET_REPOSITORY_PORT) private readonly walletRepo: WalletRepositoryPort) {}

    async execute(query: GetWithdrawalDetailAdminQuery): Promise<WithdrawalRequestItem> {
        const item = await this.walletRepo.findWithdrawalById(query.id)
        if (!item) throw new NotFoundException('Withdrawal not found')
        return item
    }
}
