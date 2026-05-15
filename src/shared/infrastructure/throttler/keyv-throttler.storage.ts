import { ThrottlerStorage } from '@nestjs/throttler'
import { Injectable, Inject } from '@nestjs/common'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'

/**
 * Cache-based throttler storage adapter for distributed rate limiting.
 *
 * This adapter allows NestJS Throttler to use the 2-layer cache system
 * (in-memory L1 + Redis L2) for storing rate limit counters, enabling
 * accurate rate limiting across multiple application instances.
 *
 * Benefits of using 2-layer cache:
 * - Fast: Most hits from L1 in-memory cache (sub-millisecond)
 * - Distributed: L2 Redis shared across instances
 * - Resilient: L1 handles Redis downtime gracefully
 */
@Injectable()
export class KeyvThrottlerStorage implements ThrottlerStorage {
    constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

    /**
     * Increment the request counter for a given key.
     */
    async increment(
        key: string,
        ttl: number,
        limit: number,
        blockDuration: number,
        throttlerName: string
    ): Promise<{
        totalHits: number
        timeToExpire: number
        isBlocked: boolean
        timeToBlockExpire: number
    }> {
        const throttleKey = `throttle:${throttlerName}:${key}`
        const blockKey = `throttle:block:${throttlerName}:${key}`

        // Check if currently blocked
        const blockedUntil = await this.cache.get<number>(blockKey)
        if (blockedUntil && Date.now() < blockedUntil) {
            const timeToBlockExpire = Math.ceil((blockedUntil - Date.now()) / 1000)
            return {
                totalHits: limit + 1,
                timeToExpire: timeToBlockExpire,
                isBlocked: true,
                timeToBlockExpire
            }
        }

        // Get current count
        const current = (await this.cache.get<number>(throttleKey)) || 0
        const newCount = current + 1

        // Store with TTL
        await this.cache.set(throttleKey, newCount, ttl)

        // If exceeded limit, set block
        if (newCount > limit && blockDuration > 0) {
            const blockUntil = Date.now() + blockDuration
            await this.cache.set(blockKey, blockUntil, blockDuration)

            return {
                totalHits: newCount,
                timeToExpire: Math.ceil(ttl / 1000),
                isBlocked: true,
                timeToBlockExpire: Math.ceil(blockDuration / 1000)
            }
        }

        return {
            totalHits: newCount,
            timeToExpire: Math.ceil(ttl / 1000),
            isBlocked: false,
            timeToBlockExpire: 0
        }
    }

    /**
     * Reset the counter for a given key.
     *
     * This deletes ALL throttle-related keys for the identifier,
     * including counter keys for all throttler names and block keys.
     */
    async reset(key: string): Promise<void> {
        try {
            // Get the underlying Redis client from Cache
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const redis = (this.cache.store as any)?.[' client']

            if (!redis) {
                // Fallback: just delete the basic key if Redis not available
                await this.cache.del(`throttle:${key}`)
                return
            }

            // Use Redis SCAN to find all matching keys
            // Pattern: throttle:*:{key} (matches both counter and block keys)
            const pattern = `throttle:*:${key}`
            const keysToDelete: string[] = []

            let cursor = '0'
            do {
                const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
                cursor = result[0]
                keysToDelete.push(...result[1])
            } while (cursor !== '0')

            // Delete all found keys
            if (keysToDelete.length > 0) {
                await redis.del(...keysToDelete)
            }
        } catch {
            // Fallback: try to delete basic patterns
            await this.cache.del(`throttle:default:${key}`)
            await this.cache.del(`throttle:block:default:${key}`)
        }
    }
}
