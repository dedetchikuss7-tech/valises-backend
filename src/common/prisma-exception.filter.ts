import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientUnknownRequestError,
  Prisma.PrismaClientValidationError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientRustPanicError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    // ✅ IMPORTANT: affichage complet dans le terminal Nest
    console.error('PRISMA ERROR:', exception);

    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    // Defaults
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error';
    let error = 'Internal Server Error';

    // Known request errors (unique constraint, FK, etc.)
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        statusCode = HttpStatus.CONFLICT;
        error = 'Conflict';
        const target = (exception.meta as any)?.target;
        message = target
          ? `Unique constraint failed on: ${
              Array.isArray(target) ? target.join(', ') : target
            }`
          : 'Unique constraint failed';
      }

      if (exception.code === 'P2003') {
        statusCode = HttpStatus.BAD_REQUEST;
        error = 'Bad Request';
        message = 'Foreign key constraint failed';
      }

      if (exception.code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND;
        error = 'Not Found';
        message = 'Record not found';
      }
    }

    // Validation errors (missing required fields, wrong types)
    if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      message = 'Invalid data for database operation';
    }

    // Initialization errors (cannot connect DB)
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      error = 'Service Unavailable';
      message = 'Database unavailable (cannot connect)';
    }

    res.status(statusCode).json({
      statusCode,
      message,
      error,
      prismaCode: exception?.code ?? undefined,
      timestamp: new Date().toISOString(),
    });
  }
}