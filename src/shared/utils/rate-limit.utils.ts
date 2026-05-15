import { Cache } from '@nestjs/cache-manager'
import { HttpStatus } from '@nestjs/common'
import { CustomException } from '@/shared/presentation/exceptions'
import { ERROR_CODES, ERROR_TYPES } from '@/shared/constants'
import { MESSAGES } from '@/shared/constants'

export interface RateLimitResult {
    newCount: number
    ttlUntilMidnight: number
}

export interface RateLimitInfo {
    limit: number
    remaining: number
    reset: number // Unix timestamp
}

/**
 * Check rate limiting for email sending operations
 * @param cache - NestJS Cache instance (2-layer: in-memory + Redis)
 * @param limitKey - Cache key for daily limit counter
 * @param cooldownKey - Cache key for cooldown tracker
 * @param maxAttempts - Maximum attempts allowed per day (default: 5)
 * @param cooldownSeconds - Cooldown period in seconds (default: 60)
 * @returns Object containing newCount and ttlUntilMidnight for updating rate limits
 * @throws CustomException if rate limit is exceeded or cooldown is active
 */
export async function checkRateLimit(
    cache: Cache,
    limitKey: string,
    cooldownKey: string,
    maxAttempts: number = 5,
    cooldownSeconds: number = 60
): Promise<RateLimitResult> {
    // Check cooldown
    const cooldown = await cache.get(cooldownKey)
    if (cooldown) {
        throw new CustomException({
            code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
            type: ERROR_TYPES.RATE_LIMIT_EXCEEDED,
            message: MESSAGES.RATE_LIMIT.COOLDOWN_ACTIVE.replace('{seconds}', cooldownSeconds.toString()),
            status: HttpStatus.TOO_MANY_REQUESTS
        })
    }

    // Check daily limit
    const dailyCount = await cache.get<number>(limitKey)
    if (dailyCount && dailyCount >= maxAttempts) {
        throw new CustomException({
            code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
            type: ERROR_TYPES.RATE_LIMIT_EXCEEDED,
            message: MESSAGES.RATE_LIMIT.DAILY_LIMIT_EXCEEDED,
            status: HttpStatus.TOO_MANY_REQUESTS
        })
    }

    // Calculate TTL until midnight
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const ttlUntilMidnight = tomorrow.getTime() - now.getTime()

    return {
        newCount: (dailyCount || 0) + 1,
        ttlUntilMidnight
    }
}

/**
 * Update rate limit counters after successful operation
 * @param cache - NestJS Cache instance (2-layer: in-memory + Redis)
 * @param limitKey - Cache key for daily limit counter
 * @param cooldownKey - Cache key for cooldown tracker
 * @param newCount - New count value
 * @param ttlUntilMidnight - TTL in milliseconds until midnight
 * @param cooldownSeconds - Cooldown period in seconds (default: 60)
 */
export async function setRateLimitCounters(
    cache: Cache,
    limitKey: string,
    cooldownKey: string,
    newCount: number,
    ttlUntilMidnight: number,
    cooldownSeconds: number = 60
): Promise<void> {
    await Promise.all([
        cache.set(limitKey, newCount, ttlUntilMidnight),
        cache.set(cooldownKey, true, cooldownSeconds * 1000)
    ])
}

/**
 * Get remaining attempts without incrementing the counter
 * Useful for displaying limit status to users without affecting their quota
 *
 * @param cache - NestJS Cache instance
 * @param limitKey - Cache key for daily limit counter
 * @param maxAttempts - Maximum attempts allowed
 * @returns Number of remaining attempts (0 if limit reached)
 *
 * @example
 * const remaining = await getRemainingAttempts(
 *     cache,
 *     `email:${userId}`,
 *     5
 * )
 * console.log(`You have ${remaining} emails remaining today`)
 */
export async function getRemainingAttempts(cache: Cache, limitKey: string, maxAttempts: number = 5): Promise<number> {
    const current = (await cache.get<number>(limitKey)) || 0
    return Math.max(0, maxAttempts - current)
}

/**
 * Get detailed rate limit information including remaining attempts and reset time
 *
 * @param cache - NestJS Cache instance
 * @param limitKey - Cache key for daily limit counter
 * @param maxAttempts - Maximum attempts allowed
 * @returns Rate limit info object with limit, remaining, and reset timestamp
 *
 * @example
 * const info = await getRateLimitInfo(cache, `email:${userId}`, 5)
 * // { limit: 5, remaining: 3, reset: 1735689600000 }
 */
export async function getRateLimitInfo(
    cache: Cache,
    limitKey: string,
    maxAttempts: number = 5
): Promise<RateLimitInfo> {
    const current = (await cache.get<number>(limitKey)) || 0
    const remaining = Math.max(0, maxAttempts - current)

    // Calculate next midnight
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const reset = tomorrow.getTime()

    return {
        limit: maxAttempts,
        remaining,
        reset
    }
}

/**
 * Manually reset rate limit counters for a user
 * Useful for admin override, testing, or giving users a second chance
 *
 * @param cache - NestJS Cache instance
 * @param limitKey - Cache key for daily limit counter
 * @param cooldownKey - Cache key for cooldown tracker
 *
 * @example
 * // Admin grants user another chance
 * await resetRateLimit(
 *     cache,
 *     `email:${userId}`,
 *     `email-cooldown:${userId}`
 * )
 */
export async function resetRateLimit(cache: Cache, limitKey: string, cooldownKey: string): Promise<void> {
    await Promise.all([cache.del(limitKey), cache.del(cooldownKey)])
}

/**
 * Generate standard HTTP rate limit headers
 * Follows industry conventions for rate limit communication
 *
 * @param limit - Maximum number of requests allowed
 * @param remaining - Number of requests remaining
 * @param resetTime - Unix timestamp when limit resets
 * @returns Object with standard rate limit headers
 *
 * @example
 * const headers = getRateLimitHeaders(100, 45, Date.now() + 3600000)
 * res.set(headers)
 *
 * Response headers:
 * X-RateLimit-Limit: 100
 * X-RateLimit-Remaining: 45
 * X-RateLimit-Reset: 1735689600
 * Retry-After: 3600
 */
export function getRateLimitHeaders(limit: number, remaining: number, resetTime: number): Record<string, string> {
    const now = Date.now()
    const retryAfter = Math.ceil((resetTime - now) / 1000) // Seconds until reset

    return {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': Math.floor(resetTime / 1000).toString(), // Unix timestamp in seconds
        'Retry-After': Math.max(0, retryAfter).toString()
    }
}
