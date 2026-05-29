import { Inject } from '@nestjs/common'
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs'

import {
    WALLET_REPOSITORY_PORT,
    WalletRepositoryPort,
    WalletBalance
} from '../../../domain/ports/wallet.repository.port'
import { GetWalletQuery } from './get-wallet.query'

@QueryHandler(GetWalletQuery)
export class GetWalletHandler implements IQueryHandler<GetWalletQuery> {
    constructor(@Inject(WALLET_REPOSITORY_PORT) private readonly walletRepo: WalletRepositoryPort) {}

    async execute(query: GetWalletQuery): Promise<WalletBalance> {
        return this.walletRepo.getBalance(query.userId)
    }
}
