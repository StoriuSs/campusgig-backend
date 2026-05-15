import { Injectable, Inject } from '@nestjs/common'
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'

/**
 * Health check indicator for the rate limiting system.
 *
 * Verifies that the 2-layer cache (in-memory + Redis) is operational.
 * Tests the cache system that throttler depends on.
 */
@Injectable()
export class ThrottlerHealthIndicator extends HealthIndicator {
    constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {
        super()
    }

    /**
     * Checks if the throttler's Redis storage is healthy.
     *
     * @param key - The key name for the health check result
     * @returns Health check result indicating if throttler storage is operational
     */
    async pingCheck(key: string): Promise<HealthIndicatorResult> {
        try {
            // Test cache read/write (throttler uses same cache system)
            const testKey = '__throttler_health_check__'
            const testValue = Date.now().toString()
            await this.cache.set(testKey, testValue, 1000) // 1 second TTL
            const result = await this.cache.get(testKey)

            if (result === testValue) {
                return this.getStatus(key, true)
            }
            return this.getStatus(key, false, { message: 'Redis read/write mismatch' })
        } catch (error) {
            return this.getStatus(key, false, {
                message: error.message
            })
        }
    }
}
