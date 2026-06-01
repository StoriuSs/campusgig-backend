import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

import { ADMIN_ACTIVITY_REPOSITORY_PORT } from './domain/ports/admin-activity.repository.port'
import { PrismaAdminActivityRepository } from './infrastructure/persistence/prisma-admin-activity.repository'
import { ListActivityHandler } from './application'
import { AdminActivityController } from './presentation/http/admin-activity.controller'

const QueryHandlers = [ListActivityHandler]

// Provides the audit-log write port (injected into gig/dispute/withdrawal/
// category/endorsement actions) and the read API. Exports the port so other
// modules can log inside their own transactions.
@Module({
    imports: [CqrsModule],
    controllers: [AdminActivityController],
    providers: [{ provide: ADMIN_ACTIVITY_REPOSITORY_PORT, useClass: PrismaAdminActivityRepository }, ...QueryHandlers],
    exports: [ADMIN_ACTIVITY_REPOSITORY_PORT]
})
export class AdminActivityModule {}
