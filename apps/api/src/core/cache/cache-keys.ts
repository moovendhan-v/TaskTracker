import type { DataScope } from '../database/data-scope.js';
import { createHash } from 'node:crypto';
import type { EntityType } from '../events/domain-event.js';

/** What a cache entry depends on: an entity type, or `access` (who may do what in a workspace). */
export type CacheTopic = EntityType | 'access';

/** Bump when cached shapes change, so a deploy never reads entries written by the previous version. */
const PREFIX = 'tf:v1';

/** Tag for everything cached about one kind of entity in one workspace. */
export function entityTag(workspaceId: string, entity: string): string {
  return `${PREFIX}:tag:ws:${workspaceId}:${entity}`;
}

/** Tag for everything cached about one user (preferences, access across workspaces). */
export function userTag(userId: string): string {
  return `${PREFIX}:tag:user:${userId}`;
}

/** A cache key: readable scope and method, then a hash of the arguments. */
export function cacheKey(scope: string, name: string, args: readonly unknown[]): string {
  const digest = createHash('sha256').update(stableStringify(args)).digest('base64url').slice(0, 32);
  return `${PREFIX}:${scope}:${name}:${digest}`;
}

/** JSON with object keys sorted, so equal arguments always hash the same. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item instanceof Set) return [...(item as Set<unknown>)].sort();
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)));
    }
    return item;
  });
}

/** A short fingerprint of the caller's space limits, or '' when they have none. */
export function spaceLimitsKey(scope: DataScope | null): string {
  if (scope?.kind !== 'workspace' || !scope.spaceRules?.length) return '';
  return createHash('sha256').update(stableStringify(scope.spaceRules)).digest('base64url').slice(0, 16);
}
