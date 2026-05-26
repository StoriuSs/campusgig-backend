import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import { Logger as PinoLogger } from 'nestjs-pino'
import { ERROR_TYPES, ERROR_CODES } from '@/shared/constants'
import { ExtendedRequest } from '@/shared/types'

// Domain exceptions
import {
    UserNotFoundException,
    UsernameTakenException,
    UsernameAlreadySetException,
    AvatarRequiredException,
    MaxSkillsReachedException,
    SkillNotFoundException,
    MaxPortfolioItemsReachedException,
    PortfolioItemNotFoundException
} from '@/modules/users/domain'

/**
 * Domain Exception Filter
 *
 * Catches domain-level exceptions and maps them to HTTP responses.
 * This is the SINGLE place where domain exceptions meet HTTP status codes.
 *
 * The domain and application layers throw pure domain errors.
 * This filter translates them into proper HTTP responses.
 */
@Catch(
    UserNotFoundException,
    UsernameTakenException,
    UsernameAlreadySetException,
    AvatarRequiredException,
    MaxSkillsReachedException,
    SkillNotFoundException,
    MaxPortfolioItemsReachedException,
    PortfolioItemNotFoundException
)
export class UsersDomainExceptionFilter implements ExceptionFilter {
    constructor(private readonly logger: PinoLogger) {}

    catch(exception: Error, host: ArgumentsHost) {
        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest<ExtendedRequest>()

        const { status, code, type, message } = this.mapException(exception)

        // Calculate request duration
        const startTime = request.startTime
        const duration = startTime ? Date.now() - startTime : undefined

        // Log the error
        this.logger.warn(
            {
                method: request.method,
                url: request.url,
                statusCode: status,
                duration,
                requestId: request.requestId,
                error: { message: exception.message }
            },
            'User domain exception caught'
        )

        // Return standard error response
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
        if (exception instanceof UserNotFoundException) {
            return {
                status: HttpStatus.NOT_FOUND,
                code: ERROR_CODES.USER_NOT_FOUND,
                type: ERROR_TYPES.USER_NOT_FOUND,
                message: exception.message
            }
        }

        if (exception instanceof UsernameTakenException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.USERNAME_CONFLICT,
                type: ERROR_TYPES.USERNAME_CONFLICT,
                message: exception.message
            }
        }

        if (exception instanceof UsernameAlreadySetException) {
            return {
                status: HttpStatus.BAD_REQUEST,
                code: ERROR_CODES.USERNAME_ALREADY_SET,
                type: ERROR_TYPES.USERNAME_ALREADY_SET,
                message: exception.message
            }
        }

        if (exception instanceof AvatarRequiredException) {
            return {
                status: HttpStatus.BAD_REQUEST,
                code: ERROR_CODES.USER_VALIDATION,
                type: ERROR_TYPES.USER_VALIDATION,
                message: exception.message
            }
        }

        if (exception instanceof MaxSkillsReachedException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.USER_MAX_SKILLS_REACHED,
                type: ERROR_TYPES.USER_MAX_SKILLS_REACHED,
                message: exception.message
            }
        }

        if (exception instanceof SkillNotFoundException) {
            return {
                status: HttpStatus.NOT_FOUND,
                code: ERROR_CODES.USER_SKILL_NOT_FOUND,
                type: ERROR_TYPES.USER_SKILL_NOT_FOUND,
                message: exception.message
            }
        }

        if (exception instanceof MaxPortfolioItemsReachedException) {
            return {
                status: HttpStatus.CONFLICT,
                code: ERROR_CODES.USER_MAX_PORTFOLIO_ITEMS_REACHED,
                type: ERROR_TYPES.USER_MAX_PORTFOLIO_ITEMS_REACHED,
                message: exception.message
            }
        }

        if (exception instanceof PortfolioItemNotFoundException) {
            return {
                status: HttpStatus.NOT_FOUND,
                code: ERROR_CODES.USER_PORTFOLIO_ITEM_NOT_FOUND,
                type: ERROR_TYPES.USER_PORTFOLIO_ITEM_NOT_FOUND,
                message: exception.message
            }
        }

        // Fallback (should never reach here due to @Catch decorator specificity. It should go to global exception filter instead)
        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            code: ERROR_CODES.BAD_REQUEST,
            type: ERROR_TYPES.BAD_REQUEST,
            message: 'An unexpected error occurred'
        }
    }
}
