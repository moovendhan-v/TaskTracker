export type DomainErrorKind = 'not_found' | 'forbidden' | 'invalid' | 'conflict';

/**
 * Business-rule failure thrown by domain policies and services. It carries no
 * HTTP details; AllExceptionsFilter maps the kind to a status code.
 */
export class DomainError extends Error {
  constructor(
    readonly kind: DomainErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }

  static notFound(what: string): DomainError {
    return new DomainError('not_found', `${what} not found`);
  }

  static forbidden(message: string): DomainError {
    return new DomainError('forbidden', message);
  }

  static invalid(message: string): DomainError {
    return new DomainError('invalid', message);
  }

  static conflict(message: string): DomainError {
    return new DomainError('conflict', message);
  }
}
