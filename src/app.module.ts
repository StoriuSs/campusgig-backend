import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { isMetricsRequest } from '@/shared/utils'

// Config imports
import {
    appConfig,
    databaseConfig,
    redisConfig,
    corsConfig,
    throttleConfig,
    emailConfig,
    uploadConfig,
    keycloakConfig,
    timeoutConfig,
    prometheusConfig,
    pinoConfig,
    validationSchema
} from '@/config'

// Shared imports
import { GlobalExceptionFilter } from '@/shared/presentation'
import {
    TransformInterceptor,
    LoggingInterceptor,
    TimeoutInterceptor,
    IdempotencyInterceptor,
    MetricsInterceptor
} from '@/shared/presentation'
import { IdempotencyService } from '@/shared/infrastructure'
import { KeyvThrottlerStorage } from '@/shared/infrastructure'
import { RequestIdMiddleware } from '@/shared/presentation'

// Core infrastructure modules
import { PrismaModule } from '@/shared/infrastructure'
import { CacheModule } from '@/shared/infrastructure'
import { BullModule } from '@nestjs/bullmq'
import { PrometheusModule } from '@/shared/infrastructure'

// Infra modules
import { EmailModule } from '@/shared/infrastructure'
import { UploadModule } from '@/shared/infrastructure'
import { KeycloakModule } from '@/shared/infrastructure'

// Top-level modules
import { HealthModule } from '@/health/health.module'

// Feature modules (Hexagonal Architecture)
import { UsersModule } from '@/modules/users/users.module'
import { UsersDomainExceptionFilter } from '@/modules/users/presentation'
import { CategoriesModule } from '@/modules/categories/categories.module'

// Guards
import { KeycloakAuthGuard } from '@/shared/infrastructure'
import { RolesGuard } from '@/shared/infrastructure'

@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            // Load .env.development or .env.production based on NODE_ENV.
            // Each file is complete and standalone — no base file merging.
            // When running in Docker, docker-compose injects vars via env_file
            // and the environment: block; this path is used for local dev without Docker.
            envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
            load: [
                appConfig,
                databaseConfig,
                redisConfig,
                corsConfig,
                throttleConfig,
                emailConfig,
                uploadConfig,
                keycloakConfig,
                timeoutConfig,
                prometheusConfig
            ],
            validationSchema,
            validationOptions: {
                abortEarly: true
            }
        }),

        // Rate limiting with 2-layer cache storage
        ThrottlerModule.forRootAsync({
            inject: [ConfigService, CACHE_MANAGER],
            useFactory: (configService: ConfigService, cache: Cache) => ({
                throttlers: [
                    {
                        name: 'relaxed', // Change this to customize throttler name in Redis keys
                        ttl: configService.get<number>('throttle.ttl')! * 1000, // Convert to milliseconds
                        limit: configService.get<number>('throttle.limit')!
                    }
                ],
                // Use 2-layer cache (in-memory + Redis) storage for distributed rate limiting
                storage: new KeyvThrottlerStorage(cache),

                // Custom tracker: Use user ID for authenticated requests, IP for anonymous
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                getTracker: (req: any) => {
                    // If user is authenticated, track by user ID
                    if (req.user?.id) {
                        return Promise.resolve(`user:${req.user.id}`)
                    }

                    // Otherwise, track by IP address with robust fallbacks
                    const ip =
                        req.ip ||
                        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                        req.socket?.remoteAddress ||
                        'unknown'

                    return Promise.resolve(ip)
                },

                // Skip rate limiting for metrics endpoint (Prometheus scraping)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                skipIf: (context: any) => {
                    const request = context.switchToHttp().getRequest()
                    return isMetricsRequest(request.url)
                }
            })
        }),

        // Pino Logger
        LoggerModule.forRoot(pinoConfig),

        // Core infrastructure
        PrismaModule,
        CacheModule,
        BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                connection: {
                    host: configService.get<string>('redis.host'),
                    port: configService.get<number>('redis.port'),
                    password: configService.get<string>('redis.password')
                }
            })
        }),
        PrometheusModule,

        // Infra
        EmailModule,
        UploadModule,
        KeycloakModule,

        // Health
        HealthModule,

        // Feature modules (Hexagonal Architecture)
        UsersModule,
        CategoriesModule
    ],
    providers: [
        // Global authentication guard (all routes protected by default)
        {
            provide: APP_GUARD,
            useClass: KeycloakAuthGuard
        },
        // Global rate limiting guard
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard
        },
        // Role-based access control guard
        {
            provide: APP_GUARD,
            useClass: RolesGuard
        },
        // Global exception filters
        {
            provide: APP_FILTER,
            useClass: GlobalExceptionFilter
        },
        // Domain exception filter (maps domain errors → HTTP responses)
        {
            provide: APP_FILTER,
            useClass: UsersDomainExceptionFilter
        },
        // Global response transformation
        {
            provide: APP_INTERCEPTOR,
            useClass: TransformInterceptor
        },
        // Global logging
        {
            provide: APP_INTERCEPTOR,
            useClass: LoggingInterceptor
        },
        // Global timeout
        {
            provide: APP_INTERCEPTOR,
            useClass: TimeoutInterceptor
        },
        // Idempotency interceptor
        {
            provide: APP_INTERCEPTOR,
            useClass: IdempotencyInterceptor
        },
        // Prometheus metrics interceptor
        {
            provide: APP_INTERCEPTOR,
            useClass: MetricsInterceptor
        },
        IdempotencyService
    ]
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(RequestIdMiddleware).forRoutes('*')
    }
}
