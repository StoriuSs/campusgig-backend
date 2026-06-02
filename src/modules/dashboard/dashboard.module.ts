import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

import { UploadModule } from '@/shared/infrastructure'

import { DASHBOARD_REPOSITORY_PORT } from './domain/ports/dashboard.repository.port'
import { PrismaDashboardRepository } from './infrastructure/persistence/prisma-dashboard.repository'
import { GetSellerDashboardHandler, GetBuyerDashboardHandler } from './application'
import { DashboardController } from './presentation/http/dashboard.controller'

const QueryHandlers = [GetSellerDashboardHandler, GetBuyerDashboardHandler]

// Per-user read-only aggregations (seller + buyer). UploadModule presigns gig
// covers + counterparty/seller avatars. PrismaService + CACHE_MANAGER are global.
@Module({
    imports: [CqrsModule, UploadModule],
    controllers: [DashboardController],
    providers: [{ provide: DASHBOARD_REPOSITORY_PORT, useClass: PrismaDashboardRepository }, ...QueryHandlers]
})
export class DashboardModule {}
