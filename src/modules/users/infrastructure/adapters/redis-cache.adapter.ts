import { Injectable, Inject, Logger } from '@nestjs/common'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { CachePort } from '@/modules/users/application'

/**
 * Redis Cache Adapter — Outbound Adapter
 *
 * Implements the CachePort using NestJS's CacheManager (backed by Redis).
 * The application layer never knows about Redis — it only knows CachePort.
 */
@Injectable()
export class RedisCacheAdapter implements CachePort {
    private readonly logger = new Logger(RedisCacheAdapter.name)

    constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

    async invalidateUser(keycloakId: string): Promise<void> {
        try {
            await this.cache.del(`user:keycloak:${keycloakId}`)
        } catch (error) {
            this.logger.warn(`Failed to invalidate cache for user ${keycloakId}`, error)
        }
    }
}
