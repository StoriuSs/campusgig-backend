import { Inject, Logger } from '@nestjs/common'
import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { MessageSentEvent } from '../../../domain/events'
import { responseTimeCacheKey } from '../../../presentation/http/messages.controller'

// When a user sends a message, their response-time stats may shift — blow
// the cache key so the next viewer of their profile/gig page sees fresh
// numbers. Skips system events (senderId == null) since those don't count
// toward response time.
@EventsHandler(MessageSentEvent)
export class InvalidateResponseTimeHandler implements IEventHandler<MessageSentEvent> {
    private readonly logger = new Logger(InvalidateResponseTimeHandler.name)

    constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

    async handle(event: MessageSentEvent): Promise<void> {
        const senderId = event.message.senderId
        if (!senderId) return
        try {
            await this.cache.del(responseTimeCacheKey(senderId))
        } catch (err) {
            this.logger.warn(`Failed to invalidate response-time cache for ${senderId}: ${(err as Error).message}`)
        }
    }
}
