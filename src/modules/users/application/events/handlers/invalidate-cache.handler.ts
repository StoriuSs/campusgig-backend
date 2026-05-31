import { EventsHandler, IEventHandler } from '@nestjs/cqrs'
import { Inject, Logger } from '@nestjs/common'
import { UserProfileUpdatedEvent } from '../user-profile-updated.event'
import { AccountDeletedEvent } from '../account-deleted.event'
import { CachePort, CACHE_PORT } from '../../ports'

@EventsHandler(UserProfileUpdatedEvent, AccountDeletedEvent)
export class InvalidateCacheHandler implements IEventHandler<UserProfileUpdatedEvent | AccountDeletedEvent> {
    private readonly logger = new Logger(InvalidateCacheHandler.name)

    constructor(@Inject(CACHE_PORT) private readonly cache: CachePort) {}

    async handle(event: UserProfileUpdatedEvent | AccountDeletedEvent): Promise<void> {
        try {
            await this.cache.invalidateUser(event.keycloakId)
        } catch (error) {
            this.logger.warn(`Failed to invalidate cache for user ${event.keycloakId}`, error)
        }
    }
}
