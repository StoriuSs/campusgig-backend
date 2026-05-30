import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { CqrsModule } from '@nestjs/cqrs'

import { GigsModule } from '@/modules/gigs/gigs.module'
import { MessagingModule } from '@/modules/messaging/messaging.module'
import { WalletModule } from '@/modules/wallet/wallet.module'
import { UploadModule } from '@/shared/infrastructure'

import {
    AcceptDeliveryHandler,
    AcceptOrderHandler,
    AutoCancelOrderHandler,
    DeclineOrderHandler,
    DeliverWorkHandler,
    GetActionRequiredCountsHandler,
    GetOrderEventsHandler,
    GetOrderHandler,
    ListOrdersHandler,
    PlaceOrderHandler,
    UpdateDeliveryHandler,
    UploadDeliveryFileHandler
} from './application'
import {
    OrderAcceptedDeliverySocketHandler,
    OrderAcceptedSocketHandler,
    OrderAutoCancelledSocketHandler,
    OrderAutoCompletedSocketHandler,
    OrderDeclinedSocketHandler,
    OrderDeliveredSocketHandler,
    OrderDeliveryUpdatedSocketHandler,
    OrderFinalizedSocketHandler,
    OrderMarkedLateSocketHandler,
    OrderPlacedSocketHandler
} from './application/events/handlers'
import { DELIVERY_STORAGE_PORT, ORDERS_REPOSITORY_PORT } from './domain/ports'
import { OrderDeadlinesConsumer } from './infrastructure/jobs/order-deadlines.consumer'
import { ORDERS_DEADLINES_QUEUE, OrderJobsScheduler } from './infrastructure/jobs/order-jobs.scheduler'
import { PrismaOrdersRepository } from './infrastructure/persistence/prisma-orders.repository'
import { S3DeliveryFileAdapter } from './infrastructure/storage/s3-delivery-file.adapter'
import { OrdersDomainExceptionFilter } from './presentation/filters/orders-domain-exception.filter'
import { OrdersController } from './presentation/http/orders.controller'

const CommandHandlers = [
    PlaceOrderHandler,
    AcceptOrderHandler,
    DeclineOrderHandler,
    DeliverWorkHandler,
    UpdateDeliveryHandler,
    AcceptDeliveryHandler,
    UploadDeliveryFileHandler,
    AutoCancelOrderHandler
]

const QueryHandlers = [GetOrderHandler, ListOrdersHandler, GetActionRequiredCountsHandler, GetOrderEventsHandler]

const EventHandlers = [
    OrderPlacedSocketHandler,
    OrderAcceptedSocketHandler,
    OrderDeclinedSocketHandler,
    OrderAutoCancelledSocketHandler,
    OrderMarkedLateSocketHandler,
    OrderDeliveredSocketHandler,
    OrderDeliveryUpdatedSocketHandler,
    OrderAcceptedDeliverySocketHandler,
    OrderAutoCompletedSocketHandler,
    OrderFinalizedSocketHandler
]

@Module({
    // MessagingModule + WalletModule are imported so the orders repo can
    // share their tx-aware methods inside its own $transaction. GigsModule
    // exposes GIG_STORAGE_PORT for avatar / cover URL resolution.
    imports: [
        CqrsModule,
        UploadModule,
        GigsModule,
        MessagingModule,
        WalletModule,
        BullModule.registerQueue({ name: ORDERS_DEADLINES_QUEUE })
    ],
    controllers: [OrdersController],
    providers: [
        { provide: ORDERS_REPOSITORY_PORT, useClass: PrismaOrdersRepository },
        { provide: DELIVERY_STORAGE_PORT, useClass: S3DeliveryFileAdapter },
        OrderJobsScheduler,
        OrderDeadlinesConsumer,
        { provide: APP_FILTER, useClass: OrdersDomainExceptionFilter },
        ...CommandHandlers,
        ...QueryHandlers,
        ...EventHandlers
    ],
    exports: [ORDERS_REPOSITORY_PORT]
})
export class OrdersModule {}
