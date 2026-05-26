import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import { Logger as PinoLogger } from 'nestjs-pino'
import { ERROR_TYPES, ERROR_CODES } from '@/shared/constants'
import { ExtendedRequest } from '@/shared/types'
import {
    CategoryNotFoundException,
    DuplicateCategoryNameException,
    InvalidCategoryIconException,
    CategoryHasGigsException,
    InvalidReassignTargetException
} from '@/modules/categories/domain'

@Catch(
    CategoryNotFoundException,
    DuplicateCategoryNameException,
    InvalidCategoryIconException,
    CategoryHasGigsException,
    InvalidReassignTargetException
)
export class CategoriesDomainExceptionFilter implements ExceptionFilter {
    constructor(private readonly logger: PinoLogger) {}

    catch(exception: Error, host: ArgumentsHost) {
        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest<ExtendedRequest>()

        const { status, code, type, message } = this.mapException(exception)

        const startTime = request.startTime
        const duration = startTime ? Date.now() - startTime : undefined

        this.logger.warn(
            {
                method: request.method,
                url: request.url,
                statusCode: status,
                duration,
                requestId: request.requestId,
                error: { message: exception.message }
            },
            'Category domain exception caught'
        )

        response.status(status).json({
            meta: {
                code,
                type,
                message,
                timestamp: new Date().toISOString(),
                request_id: request.requestId,
                request_duration: duration
            },
            data: {
                details: message,
                path: request.url,
                method: request.method
            }
        })
    }

    private mapException(exception: Error): {
        status: number
        code: string
        type: string
        message: string
    } {
        if (exception instanceof CategoryNotFoundException) {
            return {
                status: HttpStatus.NOT_FOUND,
                code: ERROR_CODES.CATEGORY_NOT_FOUND,
                type: ERROR_TYPES.CATEGORY_NOT_FOUND,
                message: exception.message
            }
        }
        if (exception instanceof DuplicateCategoryNameException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.CATEGORY_NAME_CONFLICT,
                type: ERROR_TYPES.CATEGORY_NAME_CONFLICT,
                message: exception.message
            }
        }
        if (exception instanceof InvalidCategoryIconException) {
            return {
                status: HttpStatus.BAD_REQUEST,
                code: ERROR_CODES.CATEGORY_INVALID_ICON,
                type: ERROR_TYPES.CATEGORY_INVALID_ICON,
                message: exception.message
            }
        }
        if (exception instanceof CategoryHasGigsException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.CATEGORY_HAS_GIGS,
                type: ERROR_TYPES.CATEGORY_HAS_GIGS,
                message: exception.message
            }
        }
        if (exception instanceof InvalidReassignTargetException) {
            return {
                status: HttpStatus.BAD_REQUEST,
                code: ERROR_CODES.CATEGORY_INVALID_REASSIGN_TARGET,
                type: ERROR_TYPES.CATEGORY_INVALID_REASSIGN_TARGET,
                message: exception.message
            }
        }
        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            code: ERROR_CODES.BAD_REQUEST,
            type: ERROR_TYPES.BAD_REQUEST,
            message: 'An unexpected error occurred'
        }
    }
}
