import { SetMetadata } from '@nestjs/common'

export const IDEMPOTENT_KEY = 'idempotent'

/**
 * Decorator to mark an endpoint as idempotent
 * @param ttl - Time to live for cached response (e.g., '1h', '30m', '1d')
 */
export const Idempotent = (ttl: string = '24h') => SetMetadata(IDEMPOTENT_KEY, ttl)
