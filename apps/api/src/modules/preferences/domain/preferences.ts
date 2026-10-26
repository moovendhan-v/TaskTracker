export { readPreferences } from '@taskflow/shared-types';

/** In-app paths only, so a stored tab can never send someone to another site. */
export function isAppPath(path: string): boolean {
  return /^\/(?!\/)[A-Za-z0-9/_\-?=&%.]*$/.test(path);
}

/** Replaces or appends an item by key, keeping the list under its limit (oldest dropped). */
export function upsertBy<T>(items: readonly T[], item: T, sameAs: (existing: T) => boolean, limit: number): T[] {
  const index = items.findIndex(sameAs);
  if (index >= 0) return items.map((existing, i) => (i === index ? item : existing));
  return [...items, item].slice(-limit);
}
