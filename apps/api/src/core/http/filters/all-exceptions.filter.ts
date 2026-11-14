import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { GqlContextType } from '@nestjs/graphql';
import type { Response } from 'express';
import { GraphQLError } from 'graphql';
import { QueryFailedError } from 'typeorm';
import { DomainError, type DomainErrorKind } from '../../domain/domain-error.js';
import { FieldValidationException } from '../../forms/field-validation.exception.js';

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';

/** GraphQL `extensions.code` per HTTP status, following common Apollo conventions. */
const GRAPHQL_CODES: Partial<Record<number, string>> = {
  400: 'BAD_USER_INPUT',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
};

const DOMAIN_STATUS: Record<DomainErrorKind, HttpStatus> = {
  not_found: HttpStatus.NOT_FOUND,
  forbidden: HttpStatus.FORBIDDEN,
  invalid: HttpStatus.BAD_REQUEST,
  conflict: HttpStatus.CONFLICT,
};

interface ClientError {
  status: number;
  message: string | string[];
}

/**
 * Sends clients a generic body and keeps details in the server log, so stack
 * traces and SQL never reach the browser (AGENTS.md rule 10).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): GraphQLError | void {
    const { status, message } = this.toClientError(exception);
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    // GraphQL errors are returned to the executor, which puts them in the response's `errors` array.
    if (host.getType<GqlContextType>() === 'graphql') {
      return new GraphQLError(Array.isArray(message) ? message.join(', ') : message, {
        extensions: {
          code: GRAPHQL_CODES[status] ?? 'INTERNAL_SERVER_ERROR',
          statusCode: status,
          // Per-field messages, so forms can show each one next to its input.
          ...(exception instanceof FieldValidationException ? { fields: exception.fields } : {}),
          // The permission the caller lacks (their own), so the app can say why and offer to request it.
          ...(exception instanceof DomainError && exception.missing ? { missingPermission: exception.missing.permission, spaceId: exception.missing.spaceId } : {}),
        },
      });
    }
    host.switchToHttp().getResponse<Response>().status(status).json({ statusCode: status, message });
  }

  private toClientError(exception: unknown): ClientError {
    if (exception instanceof DomainError) {
      return { status: DOMAIN_STATUS[exception.kind], message: exception.message };
    }
    if (exception instanceof HttpException) return fromHttpException(exception);
    if (exception instanceof QueryFailedError) {
      const code = (exception.driverError as { code?: string } | undefined)?.code;
      if (code === PG_UNIQUE_VIOLATION) return { status: HttpStatus.CONFLICT, message: 'Resource already exists' };
      if (code === PG_FOREIGN_KEY_VIOLATION) return { status: HttpStatus.CONFLICT, message: 'Resource is in use' };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}

function fromHttpException(exception: HttpException): ClientError {
  const body = exception.getResponse();
  const message =
    typeof body === 'object' && body !== null && 'message' in body
      ? (body as { message: string | string[] }).message
      : exception.message;
  return { status: exception.getStatus(), message };
}
