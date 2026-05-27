import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { Inject, Logger } from '@nestjs/common'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { CategoryCreatedEvent } from '../category-created.event'
import { CategoryUpdatedEvent } from '../category-updated.event'
import { CategoryDeletedEvent } from '../category-deleted.event'

/**
 * Busts the public `categories:public:all` cache whenever an admin mutates
 * a category. Same event-driven pattern used by the users module's
 * `InvalidateCacheHandler`. Documented in memory `project-caching-candidates`.
 */
const CACHE_KEY = 'categories:public:all'

@EventsHandler(CategoryCreatedEvent, CategoryUpdatedEvent, CategoryDeletedEvent)
export class InvalidatePublicCategoriesCacheHandler implements IEventHandler<
    CategoryCreatedEvent | CategoryUpdatedEvent | CategoryDeletedEvent
> {
    private readonly logger = new Logger(InvalidatePublicCategoriesCacheHandler.name)

    constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

    async handle(_event: CategoryCreatedEvent | CategoryUpdatedEvent | CategoryDeletedEvent): Promise<void> {
        try {
            await this.cache.del(CACHE_KEY)
        } catch (err) {
            this.logger.warn(`Failed to invalidate ${CACHE_KEY}: ${(err as Error).message}`)
        }
    }
}
