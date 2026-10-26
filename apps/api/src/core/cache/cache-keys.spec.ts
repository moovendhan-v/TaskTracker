import { describe, expect, it } from 'vitest';
import { cacheKey, entityTag, stableStringify } from './cache-keys.js';

describe('cache keys', () => {
  it('hash equal arguments the same, whatever the key order', () => {
    expect(cacheKey('ws:1', 'S.m', [{ a: 1, b: 2 }])).toBe(cacheKey('ws:1', 'S.m', [{ b: 2, a: 1 }]));
    expect(cacheKey('ws:1', 'S.m', [{ a: 1 }])).not.toBe(cacheKey('ws:1', 'S.m', [{ a: 2 }]));
  });

  it('keep scopes apart, so one workspace never reads another one\'s entry', () => {
    expect(cacheKey('ws:1', 'S.m', ['x'])).not.toBe(cacheKey('ws:2', 'S.m', ['x']));
    expect(entityTag('w1', 'task')).not.toBe(entityTag('w2', 'task'));
  });

  it('serialises sets in a stable order', () => {
    expect(stableStringify([new Set(['b', 'a'])])).toBe('[["a","b"]]');
  });
});
