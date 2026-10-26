import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.schema.js';
import { DecoratorRuntime } from '../runtime/decorator-runtime.js';
import { CacheInvalidator } from './cache-invalidator.js';
import { CacheStore } from './cache-store.port.js';
import { MemoryCacheStore } from './memory.cache-store.js';
import { RedisCacheStore } from './redis.cache-store.js';

/** Redis when REDIS_URL is set (required in production), otherwise an in-process cache. */
@Global()
@Module({
  providers: [
    {
      provide: CacheStore,
      inject: [ENV],
      useFactory: (env: Env): CacheStore => (env.REDIS_URL ? new RedisCacheStore(env.REDIS_URL) : new MemoryCacheStore()),
    },
    CacheInvalidator,
    DecoratorRuntime,
  ],
  exports: [CacheStore],
})
export class CacheModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown(): Promise<void> {
    const store = this.moduleRef.get(CacheStore, { strict: false });
    if (store instanceof RedisCacheStore) await store.close();
  }
}
