import { CacheStore, type CacheWriteOptions } from './cache-store.port.js';

/** Upper bound on entries, so a busy instance without Redis can't grow without limit. */
const MAX_ENTRIES = 5_000;

interface Entry {
  value: string;
  expiresAt: number;
}

/**
 * Per-instance cache for development, tests and single-instance setups without
 * Redis. Values are stored as JSON so callers get a fresh copy every time, just
 * like with Redis.
 */
export class MemoryCacheStore extends CacheStore {
  private readonly entries = new Map<string, Entry>();
  private readonly tags = new Map<string, Set<string>>();

  constructor(private readonly now: () => number = Date.now) {
    super();
  }

  get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return Promise.resolve(undefined);
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return Promise.resolve(undefined);
    }
    return Promise.resolve(JSON.parse(entry.value) as T);
  }

  set(key: string, value: unknown, { ttlSeconds, tags }: CacheWriteOptions): Promise<void> {
    if (value === undefined) return Promise.resolve();
    if (this.entries.size >= MAX_ENTRIES && !this.entries.has(key)) {
      // Maps keep insertion order, so the first key is the oldest.
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value: JSON.stringify(value), expiresAt: this.now() + ttlSeconds * 1000 });
    for (const tag of tags) {
      let keys = this.tags.get(tag);
      if (!keys) this.tags.set(tag, (keys = new Set()));
      keys.add(key);
    }
    return Promise.resolve();
  }

  invalidateTags(tags: readonly string[]): Promise<void> {
    for (const tag of tags) {
      for (const key of this.tags.get(tag) ?? []) this.entries.delete(key);
      this.tags.delete(tag);
    }
    return Promise.resolve();
  }

  isHealthy(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
