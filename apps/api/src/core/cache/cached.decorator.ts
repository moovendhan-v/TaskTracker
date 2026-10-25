import { TransactionalManager } from '../database/transactional-manager.js';
import { lookupProvider } from '../runtime/decorator-runtime.js';
import { wrapMethod } from '../runtime/method-decorator.js';
import { cacheKey, entityTag, type CacheTopic } from './cache-keys.js';
import { CacheStore } from './cache-store.port.js';

const DEFAULT_TTL_SECONDS = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CachedOptions {
  /** Entity types the result is built from. Any change to one of them in the workspace drops the entry. */
  entities: readonly CacheTopic[];
  /** Picks the workspace id from the arguments. Defaults to the first argument. */
  workspace?: (...args: never[]) => unknown;
  /**
   * The result is the same for every member who may call the method. Leave this off
   * (the default) when row-level security or the caller changes what comes back:
   * the entry is then kept per user.
   */
  shared?: boolean;
  ttlSeconds?: number;
}

/**
 * Caches an async read in the shared cache, keyed by workspace, method and
 * arguments. Entries are dropped when a domain event reports a change to one of
 * `entities` in that workspace (see CacheInvalidator), and expire after the TTL
 * in any case. Mutations always bypass the cache. Use only on methods that return
 * plain JSON (response DTOs), never domain entities.
 */
export function Cached(options: CachedOptions): MethodDecorator {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const pickWorkspace = (options.workspace ?? ((first: unknown) => first)) as (...args: unknown[]) => unknown;

  return wrapMethod((original, name) =>
    async function cached(this: unknown, ...args: unknown[]) {
      const cache = lookupProvider(CacheStore);
      const transactional = lookupProvider(TransactionalManager);
      const workspaceId = pickWorkspace(...args);
      if (!cache || !transactional?.cacheable || typeof workspaceId !== 'string' || !UUID.test(workspaceId)) {
        return original.apply(this, args);
      }

      let scope = `ws:${workspaceId}`;
      if (!options.shared) {
        const userId = transactional.scope?.kind === 'workspace' ? transactional.scope.userId : null;
        if (!userId) return original.apply(this, args);
        scope += `:u:${userId}`;
      }

      const key = cacheKey(scope, name, args);
      const hit = await cache.get<unknown>(key);
      if (hit !== undefined) return hit;

      const value: unknown = await original.apply(this, args);
      await cache.set(key, value, { ttlSeconds, tags: options.entities.map((entity) => entityTag(workspaceId, entity)) });
      return value;
    },
  );
}
