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

/** The server refused because of a permission or policy. */
export function isForbidden(error: unknown): boolean {
  return error instanceof GraphQLRequestError && error.code === 'FORBIDDEN';
}

/** It doesn't exist, or you can't see it. */
export function isNotFound(error: unknown): boolean {
  return error instanceof GraphQLRequestError && error.code === 'NOT_FOUND';
}

/** Someone changed the thing since you loaded it (optimistic concurrency). */
export function isConflict(error: unknown): boolean {
  return error instanceof GraphQLRequestError && error.code === 'CONFLICT';
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

/** The permission a FORBIDDEN error says you lack (and the project, for project-level checks), if it says. */
export function missingPermissionOf(error: unknown): { permission: string; spaceId: string | null } | null {
  if (!(error instanceof GraphQLRequestError) || error.code !== 'FORBIDDEN') return null;
  const extensions = error.errors[0]?.extensions;
  const permission = extensions?.['missingPermission'];
  if (typeof permission !== 'string' || !/^[a-z]+\.[a-z_]+$/.test(permission)) return null;
  const spaceId = extensions?.['spaceId'];
  return { permission, spaceId: typeof spaceId === 'string' && /^[0-9a-f-]{36}$/i.test(spaceId) ? spaceId : null };
}

/** Where "Why?" goes: the access checker on that permission (and project), for you, with Request access. */
export function whyHref(workspaceId: string, missing: { permission: string; spaceId: string | null }): string {
  const search = new URLSearchParams({ permission: missing.permission, ...(missing.spaceId ? { space: missing.spaceId } : {}) });
  return `/w/${workspaceId}/access?${search.toString()}`;
}

/** The workspace in the current address (/w/<id>/…), for links from places without route params. */
export function workspaceInPath(pathname: string): string | null {
  return /^\/w\/([0-9a-f-]{36})(?:\/|$)/i.exec(pathname)?.[1] ?? null;
}
