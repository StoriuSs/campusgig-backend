import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

import { UploadModule } from '@/shared/infrastructure'
import { AdminActivityModule } from '@/modules/admin-activity/admin-activity.module'

import { ADMIN_METRICS_REPOSITORY_PORT } from './domain/ports/admin-metrics.repository.port'
import { PrismaAdminMetricsRepository } from './infrastructure/persistence/prisma-admin-metrics.repository'
import { GetDashboardHandler } from './application'
import { AdminMetricsController } from './presentation/http/admin-metrics.controller'

const QueryHandlers = [GetDashboardHandler]

// Dashboard aggregates. Imports AdminActivityModule for the Recent Activity
// feed (single source of truth) and UploadModule to presign top-seller avatars.
@Module({
    imports: [CqrsModule, UploadModule, AdminActivityModule],
    controllers: [AdminMetricsController],
    providers: [{ provide: ADMIN_METRICS_REPOSITORY_PORT, useClass: PrismaAdminMetricsRepository }, ...QueryHandlers]
})
export class AdminMetricsModule {}
