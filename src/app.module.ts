import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { LoggerModule } from 'nestjs-pino'
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import { isMetricsRequest } from '@/shared/utils'

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

import { PrismaModule } from '@/shared/infrastructure'
import { CacheModule } from '@/shared/infrastructure'
import { BullModule } from '@nestjs/bullmq'
import { PrometheusModule } from '@/shared/infrastructure'

import { EmailModule } from '@/shared/infrastructure'
import { UploadModule } from '@/shared/infrastructure'
import { KeycloakModule } from '@/shared/infrastructure'

import { HealthModule } from '@/health/health.module'
import { UsersModule } from '@/modules/users/users.module'
import { UsersDomainExceptionFilter } from '@/modules/users/presentation'
import { CategoriesModule } from '@/modules/categories/categories.module'
import { GigsModule } from '@/modules/gigs/gigs.module'
import { PublicGigsModule } from '@/modules/public-gigs/public-gigs.module'
import { WishlistModule } from '@/modules/wishlist/wishlist.module'
import { WalletModule } from '@/modules/wallet/wallet.module'
import { MessagingModule } from '@/modules/messaging/messaging.module'
import { OrdersModule } from '@/modules/orders/orders.module'
import { ReviewsModule } from '@/modules/reviews/reviews.module'
import { DisputesModule } from '@/modules/disputes/disputes.module'
import { AdminActivityModule } from '@/modules/admin-activity/admin-activity.module'
import { AdminMetricsModule } from '@/modules/admin-metrics/admin-metrics.module'
import { AdminReportsModule } from '@/modules/admin-reports/admin-reports.module'
import { NotificationsModule } from '@/modules/notifications/notifications.module'
import { DashboardModule } from '@/modules/dashboard/dashboard.module'

import { KeycloakAuthGuard } from '@/shared/infrastructure'
import { RolesGuard } from '@/shared/infrastructure'

@Module({
    imports: [
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

        LoggerModule.forRoot(pinoConfig),

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

        EmailModule,
        UploadModule,
        KeycloakModule,

        HealthModule,

        UsersModule,
        CategoriesModule,
        GigsModule,
        PublicGigsModule,
        WishlistModule,
        WalletModule,
        MessagingModule,
        OrdersModule,
        ReviewsModule,
        DisputesModule,
        AdminActivityModule,
        AdminMetricsModule,
        AdminReportsModule,
        NotificationsModule,
        DashboardModule
    ],
    providers: [
        {
            provide: APP_GUARD,
            useClass: KeycloakAuthGuard
        },
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard
        },
        {
            provide: APP_GUARD,
            useClass: RolesGuard
        },
        {
            provide: APP_FILTER,
            useClass: GlobalExceptionFilter
        },
        {
            provide: APP_FILTER,
            useClass: UsersDomainExceptionFilter
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: TransformInterceptor
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: LoggingInterceptor
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: TimeoutInterceptor
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: IdempotencyInterceptor
        },
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
