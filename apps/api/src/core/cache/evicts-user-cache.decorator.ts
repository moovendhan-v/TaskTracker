import { lookupProvider } from '../runtime/decorator-runtime.js';
import { wrapMethod } from '../runtime/method-decorator.js';
import { userTag } from './cache-keys.js';
import { CacheStore } from './cache-store.port.js';

/**
 * Drops everything cached for one user after the method succeeds; the pair of
 * `@Cached({ user })`. User data has no workspace events to invalidate it.
 */
export function EvictsUserCache(pickUser: (...args: never[]) => unknown): MethodDecorator {
  return wrapMethod((original) =>
    async function evicting(this: unknown, ...args: unknown[]) {
      const result: unknown = await original.apply(this, args);
      const userId = (pickUser as (...values: unknown[]) => unknown)(...args);
      if (typeof userId === 'string' && userId) await lookupProvider(CacheStore)?.invalidateTags([userTag(userId)]);
      return result;
    },
  );
}
