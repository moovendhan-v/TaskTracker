import { randomUUID } from 'node:crypto';
import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { LiveDocRelay, type RelayHandler } from '../domain/live-doc-relay.port.js';

/** One instance: no relay. */
export class LocalLiveDocRelay extends LiveDocRelay {
  readonly enabled = false;
  readonly instanceId = 'local';

  subscribe(): Promise<void> {
    return Promise.resolve();
  }

  unsubscribe(): Promise<void> {
    return Promise.resolve();
  }

  publish(): void {}

  lock(): Promise<() => Promise<void>> {
    return Promise.resolve(() => Promise.resolve());
  }

  onReconnect(): void {}
}

/** A save lock lasts at most this long, so a crashed instance can't block saving. */
const LOCK_TTL_MS = 15_000;
/** Deletes the lock only if this instance still holds it. */
const UNLOCK_SCRIPT = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`;

/** Pages' channels; the key is `<workspaceId>:<documentId>` (both UUIDs). */
const CHANNEL_PREFIX = 'taskflow:live-doc:';
/** Larger messages are dropped rather than sent (the room's own limits keep them far smaller). */
export const RELAY_MESSAGE_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Redis pub/sub: one channel per open page, so an instance only receives the pages it has
 * open. Uses two connections, since a subscribing connection can't publish.
 */
export class RedisLiveDocRelay extends LiveDocRelay implements OnModuleDestroy {
  readonly enabled = true;
  private readonly logger = new Logger(RedisLiveDocRelay.name);
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly handlers = new Map<string, RelayHandler>();
  private readonly reconnected = new Set<() => void>();
  private ready = false;

  constructor(
    url: string,
    readonly instanceId: string,
  ) {
    super();
    const options = { maxRetriesPerRequest: 2, retryStrategy: (attempt: number) => Math.min(attempt * 500, 10_000) };
    this.publisher = new Redis(url, { ...options, enableOfflineQueue: false });
    this.subscriber = new Redis(url, options);
    for (const connection of [this.publisher, this.subscriber]) connection.on('error', (error: Error) => this.logger.warn(`Redis: ${error.message}`));
    // ioredis subscribes again by itself after a reconnect; the rooms then catch up.
    this.subscriber.on('ready', () => {
      if (this.ready) for (const callback of this.reconnected) callback();
      this.ready = true;
    });
    this.subscriber.on('messageBuffer', (channel: Buffer, message: Buffer) => {
      const handler = this.handlers.get(channel.toString().slice(CHANNEL_PREFIX.length));
      if (!handler) return;
      try {
        handler(new Uint8Array(message.buffer, message.byteOffset, message.byteLength));
      } catch (error) {
        this.logger.warn(`Dropped a live editing message: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    });
  }

  async subscribe(key: string, handler: RelayHandler): Promise<void> {
    this.handlers.set(key, handler);
    await this.subscriber.subscribe(CHANNEL_PREFIX + key);
  }

  async unsubscribe(key: string, handler: RelayHandler): Promise<void> {
    if (this.handlers.get(key) !== handler) return;
    this.handlers.delete(key);
    await this.subscriber.unsubscribe(CHANNEL_PREFIX + key).catch(() => undefined);
  }

  publish(key: string, message: Uint8Array): void {
    if (message.byteLength > RELAY_MESSAGE_MAX_BYTES) {
      this.logger.warn(`A live editing message for ${key} was too large to share (${message.byteLength} bytes)`);
      return;
    }
    this.publisher.publish(CHANNEL_PREFIX + key, Buffer.from(message.buffer, message.byteOffset, message.byteLength)).catch((error: Error) => {
      this.logger.warn(`Could not share a live editing change: ${error.message}`);
    });
  }

  async lock(key: string): Promise<(() => Promise<void>) | null> {
    const lockKey = `${CHANNEL_PREFIX}save:${key}`;
    const token = `${this.instanceId}:${randomUUID()}`;
    const taken = await this.publisher.set(lockKey, token, 'PX', LOCK_TTL_MS, 'NX');
    if (taken !== 'OK') return null;
    return async () => {
      await this.publisher.eval(UNLOCK_SCRIPT, 1, lockKey, token).catch(() => undefined);
    };
  }

  onReconnect(callback: () => void): void {
    this.reconnected.add(callback);
  }

  async onModuleDestroy(): Promise<void> {
    this.handlers.clear();
    await Promise.all([this.publisher.quit(), this.subscriber.quit()].map((done) => done.catch(() => undefined)));
  }
}
