import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '../errors/domain-errors';

export interface ErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
  details: unknown;
}

const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'TOO_MANY_REQUESTS',
  503: 'SERVICE_UNAVAILABLE',
};

/**
 * Single place that shapes every error response. Domain errors and Nest HttpExceptions
 * map to the envelope; anything else becomes a generic 500 so stack traces and
 * Prisma internals never reach the client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { envelope, headers } = this.toEnvelope(exception);

    for (const [name, value] of Object.entries(headers)) {
      response.setHeader(name, value);
    }
    response.status(envelope.statusCode).json(envelope);
  }

  private toEnvelope(exception: unknown): {
    envelope: ErrorEnvelope;
    headers: Readonly<Record<string, string>>;
  } {
    if (exception instanceof DomainError) {
      return {
        envelope: {
          statusCode: exception.statusCode,
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
        headers: exception.headers,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const body = exception.getResponse();
      const fields =
        typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
      const rawMessage = typeof body === 'string' ? body : fields.message;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join('; ')
        : typeof rawMessage === 'string'
          ? rawMessage
          : exception.message;

      return {
        envelope: {
          statusCode,
          code:
            typeof fields.code === 'string' ? fields.code : (DEFAULT_CODES[statusCode] ?? 'ERROR'),
          message,
          details: fields.details ?? null,
        },
        headers: {},
      };
    }

    this.logger.error(
      'Unhandled error',
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );
    return {
      envelope: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong on our side. Please try again.',
        details: null,
      },
      headers: {},
    };
  }
}
