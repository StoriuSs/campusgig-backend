import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { PresencePort } from '../../domain/ports'

// Keys live in their own namespace so the cache-manager 2-layer system can't
// accidentally trample them.
const ONLINE_SET = 'presence:online'
const SOCKETS_COUNT = (userId: string) => `presence:sockets:${userId}`

@Injectable()
export class RedisPresenceAdapter implements PresencePort, OnModuleDestroy {
    private readonly logger = new Logger(RedisPresenceAdapter.name)
    private readonly redis: Redis

    constructor(private readonly config: ConfigService) {
        const host = this.config.get<string>('redis.host')
        const port = this.config.get<number>('redis.port')
        const password = this.config.get<string>('redis.password')
        this.redis = new Redis({
            host,
            port,
            password: password || undefined,
            lazyConnect: false,
            maxRetriesPerRequest: 3
        })
        this.redis.on('error', (err) => {
            this.logger.error(`Redis presence error: ${err.message}`)
        })
    }

    async onModuleDestroy(): Promise<void> {
        await this.redis.quit()
    }

    async markOnline(userId: string, socketId: string): Promise<void> {
        // Track the socket id in the per-user counter SET (not a counter — a
        // set of socket ids — so reconnects with the SAME id are idempotent).
        const sockets = SOCKETS_COUNT(userId)
        await this.redis.multi().sadd(sockets, socketId).sadd(ONLINE_SET, userId).exec()
    }

    async markOffline(userId: string, socketId: string): Promise<boolean> {
        const sockets = SOCKETS_COUNT(userId)
        // Remove this socket; if it was the last one, also remove from
        // online set and signal "last socket dropped" so the gateway can
        // write lastSeenAt + emit presence:update.
        const result = await this.redis.multi().srem(sockets, socketId).scard(sockets).exec()
        if (!result) return false

        const remaining = Number(result[1][1] ?? 0)
        if (remaining === 0) {
            // Cleanup the (now empty) set + remove from online set.
            await this.redis.multi().del(sockets).srem(ONLINE_SET, userId).exec()
            return true
        }
        return false
    }

    async isOnline(userId: string): Promise<boolean> {
        const present = await this.redis.sismember(ONLINE_SET, userId)
        return present === 1
    }

    async filterOnline(userIds: string[]): Promise<Set<string>> {
        if (userIds.length === 0) return new Set()
        // SMISMEMBER returns an array of 0/1 in input order.
        const flags = await this.redis.smismember(ONLINE_SET, ...userIds)
        const online = new Set<string>()
        userIds.forEach((id, i) => {
            if (flags[i] === 1) online.add(id)
        })
        return online
    }

    async clearAll(): Promise<void> {
        // Used on module init to clear sticky-online ghosts from a previous
        // server process that didn't gracefully disconnect.
        const stream = this.redis.scanStream({
            match: 'presence:*',
            count: 100
        })
        for await (const keys of stream as AsyncIterable<string[]>) {
            if (keys.length > 0) {
                await this.redis.del(...keys)
            }
        }
    }
}
