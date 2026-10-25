import { describe, expect, it } from 'vitest';
import { MemoryCacheStore } from './memory.cache-store.js';

describe('MemoryCacheStore', () => {
  it('returns a copy of what was stored until it expires', async () => {
    let now = 1_000;
    const store = new MemoryCacheStore(() => now);
    const value = { items: [1, 2] };
    await store.set('k', value, { ttlSeconds: 10, tags: [] });
    value.items.push(3);

    expect(await store.get('k')).toEqual({ items: [1, 2] });
    now += 10_000;
    expect(await store.get('k')).toBeUndefined();
  });

  it('keeps null results, so "no access" is cached too', async () => {
    const store = new MemoryCacheStore();
    await store.set('k', null, { ttlSeconds: 10, tags: [] });
    expect(await store.get('k')).toBeNull();
  });

  it('drops every entry filed under an invalidated tag, and only those', async () => {
    const store = new MemoryCacheStore();
    await store.set('a', 1, { ttlSeconds: 60, tags: ['t1'] });
    await store.set('b', 2, { ttlSeconds: 60, tags: ['t1', 't2'] });
    await store.set('c', 3, { ttlSeconds: 60, tags: ['t2'] });

    await store.invalidateTags(['t1']);

    expect(await store.get('a')).toBeUndefined();
    expect(await store.get('b')).toBeUndefined();
    expect(await store.get('c')).toBe(3);
  });
});
