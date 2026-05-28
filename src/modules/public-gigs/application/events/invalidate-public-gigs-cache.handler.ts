import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { Inject, Logger } from '@nestjs/common'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { GigApprovedEvent } from '@/modules/gigs/application/events/gig-approved.event'
import { GigRejectedEvent } from '@/modules/gigs/application/events/gig-rejected.event'

@EventsHandler(GigApprovedEvent, GigRejectedEvent)
export class InvalidatePublicGigsCacheHandler implements IEventHandler<GigApprovedEvent | GigRejectedEvent> {
    private readonly logger = new Logger(InvalidatePublicGigsCacheHandler.name)

    constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

    async handle(event: GigApprovedEvent | GigRejectedEvent): Promise<void> {
        const gigId = event.gigId
        try {
            // Invalidate the specific gig detail cache
            await this.cache.del(`gigs:public:detail:${gigId}`)
        } catch (err) {
            this.logger.warn(`Failed to invalidate gig detail cache for ${gigId}: ${err}`)
        }

        // Attempt to invalidate browse cache keys via store's keys() if supported
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const store = (this.cache as any).store
            if (typeof store?.keys === 'function') {
                const keys: string[] = await store.keys('gigs:public:browse:*')
                await Promise.all(keys.map((k: string) => this.cache.del(k)))
            }
        } catch {
            // Not all cache backends support key scanning — TTL backstop is sufficient
        }
    }
}
