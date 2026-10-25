import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { CacheStore, type CacheWriteOptions } from './cache-store.port.js';

/** Cache calls give up quickly: a slow cache is worse than no cache. */
const COMMAND_TIMEOUT_MS = 250;

/** Deletes every key filed under the given tag sets, then the sets themselves, in one round trip. */
const INVALIDATE_SCRIPT = `
for _, tag in ipairs(KEYS) do
  local keys = redis.call('SMEMBERS', tag)
  for i = 1, #keys, 500 do
    redis.call('UNLINK', unpack(keys, i, math.min(i + 499, #keys)))
  end
  redis.call('UNLINK', tag)
end
return 0`;

/**
 * Redis adapter. Every API instance shares it. Errors are logged and treated as
 * a miss: the request falls through to Postgres.
 */
export class RedisCacheStore extends CacheStore {
  private readonly logger = new Logger(RedisCacheStore.name);
  private readonly redis: Redis;

  constructor(url: string) {
    super();
    this.redis = new Redis(url, {
      lazyConnect: false,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      commandTimeout: COMMAND_TIMEOUT_MS,
      retryStrategy: (attempt) => Math.min(attempt * 500, 10_000),
    });
    this.redis.on('error', (error: Error) => this.logger.warn(`Redis: ${error.message}`));
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch (error) {
      this.warn('read', error);
      return undefined;
    }
  }

  async set(key: string, value: unknown, { ttlSeconds, tags }: CacheWriteOptions): Promise<void> {
    if (value === undefined) return;
    try {
      const pipeline = this.redis.multi().set(key, JSON.stringify(value), 'EX', ttlSeconds);
      for (const tag of tags) {
        // A tag set lives as long as its longest-lived entry.
        pipeline.sadd(tag, key).expire(tag, ttlSeconds, 'NX').expire(tag, ttlSeconds, 'GT');
      }
      await pipeline.exec();
    } catch (error) {
      this.warn('write', error);
    }
  }

  async invalidateTags(tags: readonly string[]): Promise<void> {
    if (tags.length === 0) return;
    try {
      await this.redis.eval(INVALIDATE_SCRIPT, tags.length, ...tags);
    } catch (error) {
      // Entries expire on their own; log loudly because readers may see stale data until then.
      this.logger.error(`Cache invalidation failed for ${tags.length} tag(s): ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  private warn(operation: string, error: unknown): void {
    this.logger.warn(`Cache ${operation} skipped: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}
