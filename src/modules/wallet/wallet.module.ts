import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

import { GigsModule } from '@/modules/gigs/gigs.module'
import { AdminActivityModule } from '@/modules/admin-activity/admin-activity.module'
import { WALLET_REPOSITORY_PORT } from './domain/ports/wallet.repository.port'
import {
    ApproveWithdrawalHandler,
    DepositFundsHandler,
    GetWalletHandler,
    GetWithdrawalDetailAdminHandler,
    InvalidateWalletCacheHandler,
    ListPendingWithdrawalsAdminHandler,
    ListProcessedWithdrawalsAdminHandler,
    ListTransactionsHandler,
    RejectWithdrawalHandler,
    RequestWithdrawalHandler,
    SetupBankAccountHandler
} from './application'
import { PrismaWalletRepository } from './infrastructure/persistence/prisma-wallet.repository'
import { WalletController, AdminWithdrawalsController } from './presentation'

const CommandHandlers = [
    DepositFundsHandler,
    SetupBankAccountHandler,
    RequestWithdrawalHandler,
    ApproveWithdrawalHandler,
    RejectWithdrawalHandler
]

const QueryHandlers = [
    GetWalletHandler,
    ListTransactionsHandler,
    ListPendingWithdrawalsAdminHandler,
    ListProcessedWithdrawalsAdminHandler,
    GetWithdrawalDetailAdminHandler
]

const EventHandlers = [InvalidateWalletCacheHandler]

@Module({
    imports: [CqrsModule, GigsModule, AdminActivityModule],
    controllers: [WalletController, AdminWithdrawalsController],
    providers: [
        { provide: WALLET_REPOSITORY_PORT, useClass: PrismaWalletRepository },
        ...CommandHandlers,
        ...QueryHandlers,
        ...EventHandlers
    ],
    // Exported so F09–10 (Orders) can inject WALLET_REPOSITORY_PORT to call
    // moveToEscrow / releaseFromEscrow / refundFromEscrow.
    exports: [WALLET_REPOSITORY_PORT]
})
export class WalletModule {}
