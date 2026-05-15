import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
    BadRequestException,
    ConflictException
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap, catchError } from 'rxjs/operators'
import { Reflector } from '@nestjs/core'
import { IdempotencyService } from '@/shared/infrastructure'
import { IDEMPOTENT_KEY } from '@/shared/presentation/decorators'
import { calculateTTLInSeconds } from '@/shared/utils'

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
    private readonly logger = new Logger(IdempotencyInterceptor.name)

    constructor(
        private readonly reflector: Reflector,
        private readonly idempotencyService: IdempotencyService
    ) {}

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
        const request = context.switchToHttp().getRequest()
        const response = context.switchToHttp().getResponse()

        // Get the TTL from decorator
        const ttl = this.reflector.get<string>(IDEMPOTENT_KEY, context.getHandler())

        // If endpoint is not marked with @Idempotent, skip
        if (!ttl) {
            return next.handle()
        }

        // Get Idempotency-Key from headers
        const idempotencyKey = request.headers['idempotency-key']

        if (!idempotencyKey) {
            throw new BadRequestException('Idempotency-Key header is required for this endpoint')
        }

        // Validate idempotency key format (should be UUID or similar)
        if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
            throw new BadRequestException('Idempotency-Key header must be a non-empty string')
        }

        // Parse TTL
        const ttlSeconds = calculateTTLInSeconds(ttl)
        const ttlMs = ttlSeconds * 1000

        // Check if we have a cached response
        const cachedResponse = await this.idempotencyService.getResponse(idempotencyKey)

        if (cachedResponse) {
            if (cachedResponse.status === 'PROCESSING') {
                // Another request with the same key is currently being processed
                this.logger.debug(`Request already being processed for idempotency key: ${idempotencyKey}`)
                throw new ConflictException(
                    'A request with this Idempotency-Key is already being processed. Please retry shortly.'
                )
            }

            // COMPLETED — return the cached response
            this.logger.debug(`Returning cached response for idempotency key: ${idempotencyKey}`)
            response.status(cachedResponse.statusCode)
            return new Observable((subscriber) => {
                subscriber.next(cachedResponse.body)
                subscriber.complete()
            })
        }

        // Attempt to acquire a processing lock
        const lockAcquired = await this.idempotencyService.acquireLock(idempotencyKey, ttlMs)

        if (!lockAcquired) {
            // Another request just acquired the lock between our check and this call
            this.logger.debug(`Lock already acquired for idempotency key: ${idempotencyKey}`)
            throw new ConflictException(
                'A request with this Idempotency-Key is already being processed. Please retry shortly.'
            )
        }

        // Execute the handler
        return next.handle().pipe(
            tap((data) => {
                // Cache successful response (overwrites the PROCESSING sentinel)
                const statusCode = response.statusCode || 200
                this.idempotencyService.cacheResponse(idempotencyKey, data, statusCode, ttlMs).catch((error) => {
                    this.logger.error(`Failed to cache response: ${error.message}`)
                })
            }),
            catchError((error) => {
                // Release the lock so retries can execute fresh
                this.idempotencyService.releaseLock(idempotencyKey).catch((releaseError) => {
                    this.logger.error(`Failed to release lock: ${releaseError.message}`)
                })
                throw error
            })
        )
    }
}
