export interface CacheWriteOptions {
  ttlSeconds: number;
  /** Tags the entry is filed under; invalidating any of them drops it. */
  tags: readonly string[];
}

/**
 * Port for a shared cache. Adapters treat their own failures as a miss, so a
 * cache outage slows the API down but never breaks it or serves wrong data.
 */
export abstract class CacheStore {
  abstract get<T>(key: string): Promise<T | undefined>;
  abstract set(key: string, value: unknown, options: CacheWriteOptions): Promise<void>;
  abstract invalidateTags(tags: readonly string[]): Promise<void>;
  abstract isHealthy(): Promise<boolean>;
}
