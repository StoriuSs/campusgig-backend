import { Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { CqrsModule } from '@nestjs/cqrs'

import { GigsModule } from '@/modules/gigs/gigs.module'
import { MessagingModule } from '@/modules/messaging/messaging.module'

import {
    GetGigReviewSummaryHandler,
    ListGigReviewsHandler,
    ListSellerGigReviewsHandler,
    ReplyToReviewHandler,
    ReviewCacheInvalidationHandler,
    SubmitReviewHandler
} from './application'
import { REVIEWS_REPOSITORY_PORT } from './domain/ports/reviews.repository.port'
import { PrismaReviewsRepository } from './infrastructure/persistence/prisma-reviews.repository'
import { ReviewsDomainExceptionFilter } from './presentation/filters/reviews-domain-exception.filter'
import { ReviewsController } from './presentation/http/reviews.controller'

const CommandHandlers = [SubmitReviewHandler, ReplyToReviewHandler]
const QueryHandlers = [ListGigReviewsHandler, GetGigReviewSummaryHandler, ListSellerGigReviewsHandler]
const EventHandlers = [ReviewCacheInvalidationHandler]

@Module({
    // GigsModule exposes GIG_STORAGE_PORT (avatar URL resolution); MessagingModule
    // exposes MESSAGING_REPOSITORY_PORT + SocketEmitter for the submit system event.
    imports: [CqrsModule, GigsModule, MessagingModule],
    controllers: [ReviewsController],
    providers: [
        { provide: REVIEWS_REPOSITORY_PORT, useClass: PrismaReviewsRepository },
        { provide: APP_FILTER, useClass: ReviewsDomainExceptionFilter },
        ...CommandHandlers,
        ...QueryHandlers,
        ...EventHandlers
    ],
    exports: [REVIEWS_REPOSITORY_PORT]
})
export class ReviewsModule {}
