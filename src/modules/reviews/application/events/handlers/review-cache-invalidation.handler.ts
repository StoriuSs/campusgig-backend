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
            // Key owned by public-gigs.
            await this.cache.del(`gigs:public:detail:${gigId}`)
            const verKey = `gig:reviews:ver:${gigId}`
            const ver = (await this.cache.get<number>(verKey)) ?? 0
            await this.cache.set(verKey, ver + 1, VER_TTL_MS)
        } catch (err) {
            this.logger.warn(`Failed to invalidate review caches for gig ${gigId}: ${(err as Error).message}`)
        }

        // A new rating shifts the gig's avgRating, which the Browse rating FILTER keys on —
        // drop cached browse pages so membership doesn't lag behind by a TTL window.
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const store = (this.cache as any).store
            if (typeof store?.keys === 'function') {
                const keys: string[] = await store.keys('gigs:public:browse:*')
                await Promise.all(keys.map((k: string) => this.cache.del(k)))
            }
        } catch {
            // Not all cache backends support key scanning — the short TTL is the backstop.
        }
    }
}
