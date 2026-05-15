import { Controller, Get, Inject, Injectable } from '@nestjs/common'
import {
    HealthCheckService,
    HealthCheck,
    HealthIndicator,
    HealthIndicatorResult,
    MemoryHealthIndicator,
    DiskHealthIndicator
} from '@nestjs/terminus'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { PrismaService } from '@/shared/infrastructure'
import { Public } from '@/shared/presentation/decorators'
import { RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { MESSAGES } from '@/shared/constants'
import { ThrottlerHealthIndicator } from './throttler.health'

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
    constructor(private readonly prismaService: PrismaService) {
        super()
    }

    async pingCheck(key: string): Promise<HealthIndicatorResult> {
        try {
            await this.prismaService.$queryRaw`SELECT 1`
            return this.getStatus(key, true)
        } catch (error) {
            return this.getStatus(key, false, { message: error.message })
        }
    }
}

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
    constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {
        super()
    }

    async pingCheck(key: string): Promise<HealthIndicatorResult> {
        try {
            // Test Redis connection by setting and getting a value
            const testKey = '__health_check__'
            const testValue = Date.now().toString()
            await this.cache.set(testKey, testValue, 1000) // 1 second TTL
            const result = await this.cache.get(testKey)

            if (result === testValue) {
                return this.getStatus(key, true)
            }
            return this.getStatus(key, false, { message: 'Redis read/write mismatch' })
        } catch (error) {
            return this.getStatus(key, false, { message: error.message })
        }
    }
}

@Controller('health')
export class HealthController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly prismaHealth: PrismaHealthIndicator,
        private readonly redisHealth: RedisHealthIndicator,
        private readonly throttlerHealth: ThrottlerHealthIndicator,
        private readonly memory: MemoryHealthIndicator,
        private readonly disk: DiskHealthIndicator
    ) {}

    @Get()
    @Public()
    @HealthCheck()
    async check() {
        // Debug: Log each health check result individually
        const results: Record<string, unknown> = {}

        try {
            results.database = await this.prismaHealth.pingCheck('database')
            console.log('✅ Database check passed')
        } catch (e) {
            console.error('❌ Database check failed:', e.message)
            results.database = { status: 'down', error: e.message }
        }

        try {
            results.redis = await this.redisHealth.pingCheck('redis')
            console.log('✅ Redis check passed')
        } catch (e) {
            console.error('❌ Redis check failed:', e.message)
            results.redis = { status: 'down', error: e.message }
        }

        try {
            results.rate_limiter = await this.throttlerHealth.pingCheck('rate_limiter')
            console.log('✅ Rate limiter check passed')
        } catch (e) {
            console.error('❌ Rate limiter check failed:', e.message)
            results.rate_limiter = { status: 'down', error: e.message }
        }

        // Now run the actual health check
        return this.health.check([
            // Database check
            () => this.prismaHealth.pingCheck('database'),

            // Redis check
            () => this.redisHealth.pingCheck('redis'),

            // Rate limiter check (throttler with Redis storage)
            () => this.throttlerHealth.pingCheck('rate_limiter'),

            // Memory check (heap should not exceed 150MB)
            () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),

            // Memory check (RSS should not exceed 300MB)
            () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
            // Disk check - thresholdPercent is MAX used allowed (0.9 = fail if > 90% used)
            () =>
                this.disk.checkStorage('storage', {
                    path: process.cwd(),
                    thresholdPercent: 0.9
                })
        ])
    }

    @Get('ready')
    @Public()
    readiness() {
        return {
            code: RESPONSE_CODES.HEALTH_CHECK_SUCCESS,
            type: RESPONSE_TYPES.HEALTH_CHECK,
            message: MESSAGES.HEALTH.CHECK_SUCCESS,
            data: {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            }
        }
    }

    @Get('live')
    @Public()
    liveness() {
        return {
            code: RESPONSE_CODES.HEALTH_CHECK_SUCCESS,
            type: RESPONSE_TYPES.HEALTH_CHECK,
            message: MESSAGES.HEALTH.CHECK_SUCCESS,
            data: {
                status: 'ok',
                timestamp: new Date().toISOString()
            }
        }
    }
}
