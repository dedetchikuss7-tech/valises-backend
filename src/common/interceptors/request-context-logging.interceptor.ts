import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class RequestContextLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestContextLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<any>();
    const res = http.getResponse<any>();

    const requestId =
      this.extractRequestId(req?.headers?.['x-request-id']) ?? randomUUID();

    req.requestId = requestId;

    if (typeof res?.setHeader === 'function') {
      res.setHeader('x-request-id', requestId);
    }

    const startedAt = Date.now();
    const method = req?.method ?? 'UNKNOWN';
    const url = req?.originalUrl ?? req?.url ?? 'UNKNOWN';
    const actorUserId = req?.user?.userId ?? null;
    const actorRole = req?.user?.role ?? null;

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startedAt;
        const statusCode = res?.statusCode ?? null;

        this.logger.log(
          JSON.stringify({
            event: 'http_request_completed',
            requestId,
            method,
            url,
            statusCode,
            durationMs,
            actorUserId,
            actorRole,
          }),
        );
      }),
      catchError((error) => {
        const durationMs = Date.now() - startedAt;
        const statusCode = error?.status ?? res?.statusCode ?? 500;

        this.logger.error(
          JSON.stringify({
            event: 'http_request_failed',
            requestId,
            method,
            url,
            statusCode,
            durationMs,
            actorUserId,
            actorRole,
            errorName: error?.name ?? 'Error',
            errorMessage: error?.message ?? 'Unknown error',
          }),
        );

        return throwError(() => error);
      }),
    );
  }

  private extractRequestId(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
      return value[0].trim();
    }

    return null;
  }
}