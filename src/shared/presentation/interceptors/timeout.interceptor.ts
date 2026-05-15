import { Injectable, NestInterceptor, ExecutionContext, CallHandler, RequestTimeoutException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Observable, throwError, TimeoutError } from 'rxjs'
import { catchError, timeout } from 'rxjs/operators'

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
    private readonly timeout: number

    constructor(private readonly configService: ConfigService) {
        this.timeout = this.configService.get<number>('timeout.requestTimeout')!
    }

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        return next.handle().pipe(
            timeout(this.timeout),
            catchError((err) => {
                if (err instanceof TimeoutError) {
                    return throwError(() => new RequestTimeoutException('Request timeout'))
                }
                return throwError(() => err)
            })
        )
    }
}
