export type DomainErrorKind = 'not_found' | 'forbidden' | 'invalid' | 'conflict';

/**
 * Business-rule failure thrown by domain policies and services. It carries no
 * HTTP details; AllExceptionsFilter maps the kind to a status code.
 */
export class DomainError extends Error {
  constructor(
    readonly kind: DomainErrorKind,
    message: string,
    /** Forbidden because the caller lacks this permission (in this space, when set): clients offer "Why?". */
    readonly missing?: { permission: string; spaceId: string | null },
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

  /** Forbidden for want of one permission (the caller's own; nothing about anyone else is revealed). */
  static missingPermission(permission: string, spaceId: string | null, message: string): DomainError {
    return new DomainError('forbidden', message, { permission, spaceId });
  }

  static invalid(message: string): DomainError {
    return new DomainError('invalid', message);
  }

  static conflict(message: string): DomainError {
    return new DomainError('conflict', message);
  }
}
