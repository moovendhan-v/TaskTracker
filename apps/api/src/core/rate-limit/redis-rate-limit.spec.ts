import type { Redis } from 'ioredis';
import { describe, expect, it } from 'vitest';
import { redisAuthRateLimit, RedisThrottlerStorage } from './redis-rate-limit.js';

/** Just enough of Redis for the fixed-window script: one counter per key, and plain keys with expiry. */
function fakeRedis(down = false): Redis {
  const counters = new Map<string, number>();
  const plain = new Map<string, number>();
  const fail = () => Promise.reject(new Error('connection refused'));
  return {
    eval: async (_script: string, _keys: number, key: string, windowMs: string) => {
      if (down) return fail();
      const count = (counters.get(key) ?? 0) + 1;
      counters.set(key, count);
      return [count, Number(windowMs)];
    },
    pttl: async (key: string) => (down ? fail() : (plain.get(key) ?? -2)),
    set: async (key: string, _value: string, _px: string, ms: number) => (down ? fail() : (plain.set(key, ms), 'OK')),
  } as unknown as Redis;
}

describe('rate limits in Redis', () => {
  it('counts across instances: two stores on one Redis share the window', async () => {
    const redis = fakeRedis();
    const a = new RedisThrottlerStorage(redis);
    const b = new RedisThrottlerStorage(redis);
    await a.increment('ip:1', 60_000, 2, 0, 'default');
    await b.increment('ip:1', 60_000, 2, 0, 'default');
    const third = await a.increment('ip:1', 60_000, 2, 0, 'default');
    expect(third).toMatchObject({ totalHits: 3, isBlocked: true, timeToExpire: 60 });
  });

  it('keeps someone blocked for the block duration', async () => {
    const storage = new RedisThrottlerStorage(fakeRedis());
    for (let index = 0; index < 2; index += 1) await storage.increment('user:x', 60_000, 1, 300_000, 'default');
    expect(await storage.increment('user:x', 60_000, 1, 300_000, 'default')).toMatchObject({ isBlocked: true, timeToBlockExpire: 300 });
  });

  it('keeps limiting on this instance while Redis is down', async () => {
    const storage = new RedisThrottlerStorage(fakeRedis(true));
    expect((await storage.increment('ip:2', 60_000, 1, 0, 'default')).isBlocked).toBe(false);
    expect((await storage.increment('ip:2', 60_000, 1, 0, 'default')).isBlocked).toBe(true);
  });

  it('applies Better Auth rules (window in seconds) with a retry time', async () => {
    const limiter = redisAuthRateLimit(fakeRedis());
    const rule = { window: 60, max: 2 };
    expect(await limiter.consume('1.2.3.4/sign-in/email', rule)).toEqual({ allowed: true, retryAfter: null });
    await limiter.consume('1.2.3.4/sign-in/email', rule);
    expect(await limiter.consume('1.2.3.4/sign-in/email', rule)).toEqual({ allowed: false, retryAfter: 60 });
  });
});
