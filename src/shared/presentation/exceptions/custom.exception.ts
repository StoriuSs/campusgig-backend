import { HttpException, HttpStatus } from '@nestjs/common'

export interface CustomExceptionOptions {
    code: string
    type: string
    message?: string | string[]
    errors?: Record<string, unknown> | unknown[]
    status?: number
}

export class CustomException extends HttpException {
    readonly code: string
    readonly type: string
    readonly errors: Record<string, unknown> | unknown[] | null

    constructor(options: CustomExceptionOptions) {
        super(
            {
                message: options.message || 'Error',
                code: options.code,
                type: options.type,
                errors: options.errors || null
            },
            options.status || HttpStatus.INTERNAL_SERVER_ERROR
        )
        this.code = options.code
        this.type = options.type
        this.errors = options.errors || null
    }
}
