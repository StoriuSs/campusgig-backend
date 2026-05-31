import { Inject, Logger } from '@nestjs/common'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { EventsHandler, IEventHandler } from '@nestjs/cqrs'

import { ReviewRepliedEvent, ReviewSubmittedEvent } from '../../../domain/events'

const VER_TTL_MS = 30 * 24 * 60 * 60 * 1000

// Clears the gig's cached public detail + bumps the reviews-list version so
// every cached (tier, page) entry for that gig is abandoned. Fires on both a
// new review and a seller reply.
@EventsHandler(ReviewSubmittedEvent, ReviewRepliedEvent)
export class ReviewCacheInvalidationHandler implements IEventHandler<ReviewSubmittedEvent | ReviewRepliedEvent> {
    private readonly logger = new Logger(ReviewCacheInvalidationHandler.name)

    constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

    async handle(event: ReviewSubmittedEvent | ReviewRepliedEvent): Promise<void> {
        const { gigId } = event
        try {
            // Key owned by public-gigs. Browse-list card ratings refresh via their own short TTL.
            await this.cache.del(`gigs:public:detail:${gigId}`)
            const verKey = `gig:reviews:ver:${gigId}`
            const ver = (await this.cache.get<number>(verKey)) ?? 0
            await this.cache.set(verKey, ver + 1, VER_TTL_MS)
        } catch (err) {
            this.logger.warn(`Failed to invalidate review caches for gig ${gigId}: ${(err as Error).message}`)
        }
    }
}
