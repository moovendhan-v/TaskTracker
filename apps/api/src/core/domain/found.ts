import { DomainError } from './domain-error.js';

/** Returns the value, or throws NOT_FOUND naming what was missing. Replaces the `if (!x) throw` pattern. */
export function found<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw DomainError.notFound(what);
  return value;
}
