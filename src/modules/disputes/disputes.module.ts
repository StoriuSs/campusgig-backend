import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { CqrsModule } from '@nestjs/cqrs'

import { GigsModule } from '@/modules/gigs/gigs.module'
import { MessagingModule } from '@/modules/messaging/messaging.module'
import { OrdersModule } from '@/modules/orders/orders.module'
import { WalletModule } from '@/modules/wallet/wallet.module'
import { AdminActivityModule } from '@/modules/admin-activity/admin-activity.module'

import {
    AddDisputeEvidenceHandler,
    DisputeFiledSocketHandler,
    DisputeResolvedSocketHandler,
    DisputeUpdatedSocketHandler,
    ExpireDisputeResponseHandler,
    FileDisputeHandler,
    GetAdminDisputeHandler,
    ListAdminDisputesHandler,
    ResolveDisputeHandler,
    RespondToDisputeHandler,
    UploadEvidenceFileHandler
} from './application'
import { DISPUTES_REPOSITORY_PORT } from './domain/ports/disputes.repository.port'
import { PrismaDisputesRepository } from './infrastructure/persistence/prisma-disputes.repository'
import { DISPUTES_QUEUE, DisputeJobsScheduler } from './infrastructure/jobs/dispute-jobs.scheduler'
import { DisputeResponseConsumer } from './infrastructure/jobs/dispute-response.consumer'
import { DisputesDomainExceptionFilter } from './presentation/filters/disputes-domain-exception.filter'
import { DisputesController } from './presentation/http/disputes.controller'
import { AdminDisputesController } from './presentation/http/admin-disputes.controller'

const CommandHandlers = [
    FileDisputeHandler,
    RespondToDisputeHandler,
    AddDisputeEvidenceHandler,
    ResolveDisputeHandler,
    ExpireDisputeResponseHandler,
    UploadEvidenceFileHandler
]
const QueryHandlers = [ListAdminDisputesHandler, GetAdminDisputeHandler]
const EventHandlers = [DisputeFiledSocketHandler, DisputeResolvedSocketHandler, DisputeUpdatedSocketHandler]

// MessagingModule + WalletModule provide tx-aware system-event + escrow methods.
// OrdersModule exposes ORDERS_REPOSITORY_PORT (OrderDetail rebuild) + the
// delivery storage port (evidence upload/download). GigsModule exposes the image
// storage port for avatar presigning. Orders does NOT import this module.
@Module({
    imports: [
        CqrsModule,
        MessagingModule,
        WalletModule,
        OrdersModule,
        GigsModule,
        AdminActivityModule,
        BullModule.registerQueue({ name: DISPUTES_QUEUE })
    ],
    controllers: [DisputesController, AdminDisputesController],
    providers: [
        { provide: DISPUTES_REPOSITORY_PORT, useClass: PrismaDisputesRepository },
        { provide: APP_FILTER, useClass: DisputesDomainExceptionFilter },
        DisputeJobsScheduler,
        DisputeResponseConsumer,
        ...CommandHandlers,
        ...QueryHandlers,
        ...EventHandlers
    ]
})
export class DisputesModule {}
