import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';

/**
 * Sends clients a generic body and keeps details in the server log, so stack
 * traces and SQL never reach the browser (AGENTS.md rule 10).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, message } = this.toClientError(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    response.status(status).json({ statusCode: status, message });
  }

  private toClientError(exception: unknown): { status: number; message: string | string[] } {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? (body as { message: string | string[] }).message
          : exception.message;
      return { status: exception.getStatus(), message };
    }
    if (exception instanceof QueryFailedError) {
      const code = (exception.driverError as { code?: string } | undefined)?.code;
      if (code === PG_UNIQUE_VIOLATION) return { status: HttpStatus.CONFLICT, message: 'Resource already exists' };
      if (code === PG_FOREIGN_KEY_VIOLATION) return { status: HttpStatus.CONFLICT, message: 'Resource is in use' };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}
