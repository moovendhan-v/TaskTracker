import { GraphQLRequestError } from '@taskflow/sdk';

/** Error codes that mean the request itself was wrong, so retrying won't help. */
const CLIENT_ERROR_CODES = new Set([
  'BAD_USER_INPUT',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'TOO_MANY_REQUESTS',
  'GRAPHQL_VALIDATION_FAILED',
  'GRAPHQL_PARSE_FAILED',
  'QUERY_TOO_COMPLEX',
]);

export function isClientError(error: unknown): boolean {
  return error instanceof GraphQLRequestError && CLIENT_ERROR_CODES.has(error.code ?? '');
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof GraphQLRequestError && error.code === 'UNAUTHENTICATED';
}

/** A message that's safe and useful to show the user. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof GraphQLRequestError) return isClientError(error) ? error.message : fallback;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return fallback;
}
