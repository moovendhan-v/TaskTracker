import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';

/** @nestjs/throttler's storage record (not exported from the package root). */
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

const logger = new Logger('RateLimit');
const PREFIX = 'tf:rl:';

/**
 * One fixed-window counter in Redis: INCR, and on the first hit set the window's expiry. Returns the
 * count so far and how long the window has left. Atomic, so every API instance shares the count.
 */
const HIT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return {count, ttl}`;

let shared: { url: string; redis: Redis } | null = null;

/** One connection for rate limiting per process (both limiters share it). */
export function rateLimitRedis(url: string): Redis {
  if (shared?.url === url) return shared.redis;
  const redis = new Redis(url, { lazyConnect: false, enableOfflineQueue: false, maxRetriesPerRequest: 1, connectTimeout: 2_000 });
  redis.on('error', (error) => logger.warn(`Rate-limit Redis: ${error.message}`));
  shared = { url, redis };
  return redis;
}

/** A local fallback with the same fixed-window rule, used only while Redis can't be reached. */
class MemoryWindows {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  hit(key: string, windowMs: number): { count: number; ttl: number } {
    const now = Date.now();
    if (this.windows.size > 50_000) for (const [stale, entry] of this.windows) if (entry.resetAt <= now) this.windows.delete(stale);
    const entry = this.windows.get(key);
    if (!entry || entry.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      return { count: 1, ttl: windowMs };
    }
    entry.count += 1;
    return { count: entry.count, ttl: entry.resetAt - now };
  }
}

async function hit(redis: Redis, fallback: MemoryWindows, key: string, windowMs: number): Promise<{ count: number; ttl: number }> {
  try {
    const [count, ttl] = (await redis.eval(HIT, 1, `${PREFIX}${key}`, String(windowMs))) as [number, number];
    return { count: Number(count), ttl: Number(ttl) };
  } catch {
    // Redis is down: keep limiting on this instance rather than failing every request or none.
    return fallback.hit(key, windowMs);
  }
}

/**
 * The API's throttler storage (@nestjs/throttler) in Redis, so limits hold across all API
 * instances instead of per instance. Blocking past the limit lasts `blockDuration`.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly fallback = new MemoryWindows();
  constructor(private readonly redis: Redis) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    const blockKey = `block:${throttlerName}:${key}`;
    const blockedFor = await this.redis.pttl(`${PREFIX}${blockKey}`).catch(() => -2);
    if (blockedFor > 0) return { totalHits: limit + 1, timeToExpire: Math.ceil(blockedFor / 1000), isBlocked: true, timeToBlockExpire: Math.ceil(blockedFor / 1000) };
    const { count, ttl: left } = await hit(this.redis, this.fallback, `${throttlerName}:${key}`, ttl);
    const isBlocked = count > limit;
    if (isBlocked && blockDuration > 0) await this.redis.set(`${PREFIX}${blockKey}`, '1', 'PX', blockDuration).catch(() => undefined);
    const blockSeconds = isBlocked ? Math.ceil((blockDuration > 0 ? blockDuration : left) / 1000) : 0;
    return { totalHits: count, timeToExpire: Math.ceil(left / 1000), isBlocked, timeToBlockExpire: blockSeconds };
  }
}

/** Better Auth's rate-limit store (rateLimit.customStorage) in Redis, with the same fallback. */
export function redisAuthRateLimit(redis: Redis): { consume: (key: string, rule: { window: number; max: number }) => Promise<{ allowed: boolean; retryAfter: number | null }> } {
  const fallback = new MemoryWindows();
  return {
    async consume(key, rule) {
      const { count, ttl } = await hit(redis, fallback, `auth:${key}`, rule.window * 1000);
      return count <= rule.max ? { allowed: true, retryAfter: null } : { allowed: false, retryAfter: Math.max(1, Math.ceil(ttl / 1000)) };
    },
  };
}
