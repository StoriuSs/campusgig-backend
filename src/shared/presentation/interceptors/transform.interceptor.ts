import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { instanceToPlain } from 'class-transformer'
import snakecaseKeys from 'snakecase-keys'
import { RESPONSE_CODES, RESPONSE_TYPES } from '@/shared/constants'
import { ExtendedRequest } from '@/shared/types'
import { RAW_RESPONSE_KEY } from '@/shared/presentation/decorators'
import { isMetricsRequest } from '@/shared/utils'

export interface Response<T> {
    success: boolean
    statusCode: number
    message: string
    data: T
    timestamp: string
}

export interface ApiResponse<T = unknown> {
    meta: {
        code: string
        type: string
        message: string
        timestamp: string
        request_id?: string
        request_duration?: number
    }
    data: T
}

export { ApiResponse as ApiResponseInterface }

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
    constructor(private readonly reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
        const ctx = context.switchToHttp()
        const request = ctx.getRequest<ExtendedRequest>()

        // Check for @RawResponse() decorator
        const isRawResponse = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
            context.getHandler(),
            context.getClass()
        ])

        // Skip transformation for raw responses or /metrics endpoint
        if (isRawResponse || isMetricsRequest(request.url)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return next.handle() as any
        }

        return next.handle().pipe(
            map((data) => {
                // Transform class instances to plain objects with proper serialization
                let transformedData = data
                if (data && typeof data === 'object') {
                    transformedData = instanceToPlain(data)
                }

                // Convert to snake_case
                if (typeof transformedData === 'object' && transformedData !== null) {
                    transformedData = snakecaseKeys(transformedData as Record<string, unknown>, { deep: true })
                }

                // Get request duration calculated by middleware
                const startTime = request.startTime
                const requestDuration = startTime ? Date.now() - startTime : undefined

                // If transformedData already has the new structure (code, type, message, data), transform it to meta/data format
                if (
                    transformedData &&
                    typeof transformedData === 'object' &&
                    'code' in transformedData &&
                    'type' in transformedData
                ) {
                    return {
                        meta: {
                            code: transformedData.code,
                            type: transformedData.type,
                            message: transformedData.message || 'Success',
                            timestamp: new Date().toISOString(),
                            request_id: request.requestId,
                            request_duration: requestDuration
                        },
                        data: transformedData.data !== undefined ? transformedData.data : null
                    }
                }

                // If transformedData already has meta/data structure, return as is
                if (transformedData && typeof transformedData === 'object' && 'meta' in transformedData) {
                    return transformedData
                }

                // Default transformation for legacy responses
                return {
                    meta: {
                        code: RESPONSE_CODES.SUCCESS,
                        type: RESPONSE_TYPES.SUCCESS,
                        message: transformedData?.message || 'Success',
                        timestamp: new Date().toISOString(),
                        request_id: request.requestId,
                        request_duration: requestDuration
                    },
                    data: transformedData?.data !== undefined ? transformedData.data : transformedData
                } as ApiResponse<T>
            })
        )
    }
}
