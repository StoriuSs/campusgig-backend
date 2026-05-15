import { Injectable, OnModuleDestroy, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'

/**
 * Service responsible for graceful cleanup of cache connections.
 * Implements OnModuleDestroy to properly close Redis connections
 * during application shutdown.
 */
@Injectable()
export class CacheCleanupService implements OnModuleDestroy {
    constructor(
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        private readonly configService: ConfigService
    ) {}

    async onModuleDestroy() {
        // Use console.log for shutdown - Pino is async and doesn't flush before exit
        console.log('📦 Closing cache connections...')

        const timeout = this.configService.get<number>('app.gracefulShutdownTimeout')!

        // Wrap in timeout to prevent hanging
        const cleanupPromise = this.cleanup()
        const timeoutPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
                console.log(`⚠️  Cache cleanup timed out after ${timeout}ms, continuing...`)
                resolve()
            }, timeout)
        })

        // Try to close Redis gracefully but give up after timeout if stuck
        await Promise.race([cleanupPromise, timeoutPromise])

        console.log('✅ Cache cleanup complete')
    }

    private async cleanup(): Promise<void> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const store = this.cacheManager.store as any

            // Try to close multi-layer stores
            if (store?.stores && Array.isArray(store.stores)) {
                for (const keyvStore of store.stores) {
                    try {
                        // KeyvRedis uses disconnect()
                        if (typeof keyvStore?.disconnect === 'function') {
                            await keyvStore.disconnect()
                        }
                    } catch {
                        // Ignore individual store errors
                    }
                }
            }
        } catch (error) {
            console.log(`⚠️  Cache cleanup error (non-fatal): ${error.message}`)
        }
    }
}
