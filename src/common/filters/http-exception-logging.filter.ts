import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class HttpExceptionLoggingFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionLoggingFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const req = ctx.getRequest<any>();
    const res = ctx.getResponse<any>();

    const isHttpException = exception instanceof HttpException;

    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException
      ? exception.getResponse()
      : {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          error: 'Internal Server Error',
        };

    const responseBody =
      typeof exceptionResponse === 'string'
        ? {
            statusCode: status,
            message: exceptionResponse,
            error:
              status === HttpStatus.INTERNAL_SERVER_ERROR
                ? 'Internal Server Error'
                : 'Error',
          }
        : (exceptionResponse as Record<string, unknown>);

    const requestId = req?.requestId ?? req?.headers?.['x-request-id'] ?? null;
    const method = req?.method ?? 'UNKNOWN';
    const url = req?.originalUrl ?? req?.url ?? 'UNKNOWN';
    const actorUserId = req?.user?.userId ?? null;
    const actorRole = req?.user?.role ?? null;

    this.logger.error(
      JSON.stringify({
        event: 'http_exception_captured',
        requestId,
        method,
        url,
        statusCode: status,
        actorUserId,
        actorRole,
        errorName:
          exception instanceof Error ? exception.name : 'UnknownException',
        errorMessage:
          exception instanceof Error ? exception.message : 'Unknown exception',
        responseBody,
      }),
    );

    if (res?.headersSent) {
      return;
    }

    if (typeof res?.status === 'function' && typeof res?.json === 'function') {
      res.status(status).json({
        ...responseBody,
        requestId,
      });
      return;
    }

    throw exception;
  }
}