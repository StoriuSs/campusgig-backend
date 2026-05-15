/**
 * Cache Port (Application Layer)
 *
 * Defines what the application needs from a caching system.
 * No knowledge of Redis, in-memory cache, or any specific cache backend.
 */
export interface CachePort {
    /**
     * Invalidate cached user data by Keycloak ID.
     */
    invalidateUser(keycloakId: string): Promise<void>
}

export const CACHE_PORT = Symbol('CachePort')
