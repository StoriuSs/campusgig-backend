import { Injectable, Logger, Inject } from '@nestjs/common'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'

export interface CachedResponse {
    status: 'PROCESSING' | 'COMPLETED'
    statusCode: number
    body: unknown
    timestamp: number
}

@Injectable()
export class IdempotencyService {
    private readonly logger = new Logger(IdempotencyService.name)

    constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

    /**
     * Generate a Redis key for idempotency
     */
    private generateKey(idempotencyKey: string): string {
        return `idempotency:${idempotencyKey}`
    }

    /**
     * Attempt to acquire a processing lock for the given idempotency key.
     * This prevents two concurrent requests with the same key from both executing.
     *
     * @returns true if lock was acquired (no existing entry), false if key already exists
     */
    async acquireLock(idempotencyKey: string, ttlMs: number): Promise<boolean> {
        const key = this.generateKey(idempotencyKey)

        try {
            const existing = await this.cache.get<CachedResponse>(key)

            if (existing) {
                // Key already exists (either PROCESSING or COMPLETED)
                return false
            }

            // Write a PROCESSING sentinel
            const lock: CachedResponse = {
                status: 'PROCESSING',
                statusCode: 0,
                body: null,
                timestamp: Date.now()
            }
            await this.cache.set(key, lock, ttlMs)
            return true
        } catch (error) {
            this.logger.error(`Failed to acquire idempotency lock: ${error.message}`, error)
            // Fail-open: allow request to proceed if locking fails
            return true
        }
    }

    /**
     * Release a processing lock (delete the PROCESSING sentinel).
     * Called when the handler throws an error, so retries can execute fresh.
     */
    async releaseLock(idempotencyKey: string): Promise<void> {
        const key = this.generateKey(idempotencyKey)
        try {
            const existing = await this.cache.get<CachedResponse>(key)
            // Only delete if it's still in PROCESSING state (don't delete a COMPLETED response)
            if (existing && existing.status === 'PROCESSING') {
                await this.cache.del(key)
            }
        } catch (error) {
            this.logger.error(`Failed to release idempotency lock: ${error.message}`, error)
        }
    }

    /**
     * Store a completed response, overwriting the PROCESSING sentinel.
     */
    async cacheResponse(idempotencyKey: string, response: unknown, statusCode: number, ttlMs: number): Promise<void> {
        const key = this.generateKey(idempotencyKey)
        const cachedResponse: CachedResponse = {
            status: 'COMPLETED',
            statusCode,
            body: response,
            timestamp: Date.now()
        }

        try {
            await this.cache.set(key, cachedResponse, ttlMs)
        } catch (error) {
            this.logger.error(`Failed to cache idempotency response: ${error.message}`, error)
            // Don't throw - allow request to continue if caching fails
        }
    }

    /**
     * Retrieve a cached response
     */
    async getResponse(idempotencyKey: string): Promise<CachedResponse | undefined> {
        const key = this.generateKey(idempotencyKey)

        try {
            return await this.cache.get<CachedResponse>(key)
        } catch (error) {
            this.logger.error(`Failed to retrieve idempotency response: ${error.message}`, error)
            // Return undefined to allow fresh execution if retrieval fails
            return undefined
        }
    }

    /**
     * Check if response is still valid (not expired beyond our check)
     */
    isResponseValid(cachedResponse: CachedResponse, maxAgeMs: number): boolean {
        const age = Date.now() - cachedResponse.timestamp
        return age <= maxAgeMs
    }

    /**
     * Clear a cached response
     */
    async clearResponse(idempotencyKey: string): Promise<void> {
        const key = this.generateKey(idempotencyKey)
        try {
            await this.cache.del(key)
        } catch (error) {
            this.logger.error(`Failed to clear idempotency response: ${error.message}`, error)
        }
    }
}
