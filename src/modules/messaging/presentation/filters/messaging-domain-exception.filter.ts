import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import { Logger as PinoLogger } from 'nestjs-pino'
import { ERROR_TYPES, ERROR_CODES } from '@/shared/constants'
import { ExtendedRequest } from '@/shared/types'
import {
    CannotMessageSelfException,
    NotAThreadParticipantException,
    EmptyMessageException,
    TooManyAttachmentsException,
    UnsupportedAttachmentTypeException,
    AttachmentTooLargeException,
    ThreadNotFoundException,
    ThreadFrozenException
} from '../../domain/exceptions'

@Catch(
    CannotMessageSelfException,
    NotAThreadParticipantException,
    EmptyMessageException,
    TooManyAttachmentsException,
    UnsupportedAttachmentTypeException,
    AttachmentTooLargeException,
    ThreadNotFoundException,
    ThreadFrozenException
)
export class MessagingDomainExceptionFilter implements ExceptionFilter {
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
            'Messaging domain exception caught'
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
        if (exception instanceof CannotMessageSelfException) {
            return {
                status: HttpStatus.BAD_REQUEST,
                code: ERROR_CODES.MESSAGING_CANNOT_MESSAGE_SELF,
                type: ERROR_TYPES.MESSAGING_CANNOT_MESSAGE_SELF,
                message: exception.message
            }
        }
        if (exception instanceof NotAThreadParticipantException) {
            return {
                status: HttpStatus.FORBIDDEN,
                code: ERROR_CODES.MESSAGING_NOT_A_PARTICIPANT,
                type: ERROR_TYPES.MESSAGING_NOT_A_PARTICIPANT,
                message: exception.message
            }
        }
        if (exception instanceof EmptyMessageException) {
            return {
                status: HttpStatus.BAD_REQUEST,
                code: ERROR_CODES.MESSAGING_EMPTY_MESSAGE,
                type: ERROR_TYPES.MESSAGING_EMPTY_MESSAGE,
                message: exception.message
            }
        }
        if (exception instanceof TooManyAttachmentsException) {
            return {
                status: HttpStatus.UNPROCESSABLE_ENTITY,
                code: ERROR_CODES.MESSAGING_TOO_MANY_ATTACHMENTS,
                type: ERROR_TYPES.MESSAGING_TOO_MANY_ATTACHMENTS,
                message: exception.message
            }
        }
        if (exception instanceof UnsupportedAttachmentTypeException) {
            return {
                status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                code: ERROR_CODES.MESSAGING_UNSUPPORTED_ATTACHMENT_TYPE,
                type: ERROR_TYPES.MESSAGING_UNSUPPORTED_ATTACHMENT_TYPE,
                message: exception.message
            }
        }
        if (exception instanceof AttachmentTooLargeException) {
            return {
                status: HttpStatus.PAYLOAD_TOO_LARGE,
                code: ERROR_CODES.MESSAGING_ATTACHMENT_TOO_LARGE,
                type: ERROR_TYPES.MESSAGING_ATTACHMENT_TOO_LARGE,
                message: exception.message
            }
        }
        if (exception instanceof ThreadNotFoundException) {
            return {
                status: HttpStatus.NOT_FOUND,
                code: ERROR_CODES.MESSAGING_THREAD_NOT_FOUND,
                type: ERROR_TYPES.MESSAGING_THREAD_NOT_FOUND,
                message: exception.message
            }
        }
        if (exception instanceof ThreadFrozenException) {
            return {
                status: HttpStatus.FORBIDDEN,
                code: ERROR_CODES.MESSAGING_THREAD_FROZEN,
                type: ERROR_TYPES.MESSAGING_THREAD_FROZEN,
                message: exception.message
            }
        }
        return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            code: ERROR_CODES.BAD_REQUEST,
            type: ERROR_TYPES.BAD_REQUEST,
            message: 'An unexpected messaging error occurred'
        }
    }
}
