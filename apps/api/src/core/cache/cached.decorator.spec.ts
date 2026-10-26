import type { ModuleRef } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TransactionalManager } from '../database/transactional-manager.js';
import { DecoratorRuntime } from '../runtime/decorator-runtime.js';
import { tagsForChange } from './cache-invalidator.js';
import { CacheStore } from './cache-store.port.js';
import { Cached } from './cached.decorator.js';
import { MemoryCacheStore } from './memory.cache-store.js';

const WS = '00000000-0000-4000-8000-000000000001';
const OTHER_WS = '00000000-0000-4000-8000-000000000002';

class FakeTransactional {
  cacheable = true;
  scope: { kind: 'workspace'; workspaceId: string; userId: string | null } | null = { kind: 'workspace', workspaceId: WS, userId: 'u1' };
}

class Reads {
  calls = 0;

  @Cached({ entities: ['task'], shared: true })
  async shared(workspaceId: string, filter: string): Promise<string[]> {
    this.calls += 1;
    return [workspaceId, filter, String(this.calls)];
  }

  @Cached({ entities: ['notification'] })
  async perUser(_workspaceId: string): Promise<number> {
    this.calls += 1;
    return this.calls;
  }
}

describe('@Cached', () => {
  let cache: MemoryCacheStore;
  let transactional: FakeTransactional;
  let runtime: DecoratorRuntime;

  beforeEach(() => {
    cache = new MemoryCacheStore();
    transactional = new FakeTransactional();
    const ref = {
      get: (token: unknown) => (token === CacheStore ? cache : token === TransactionalManager ? transactional : null),
    } as unknown as ModuleRef;
    runtime = new DecoratorRuntime(ref);
    runtime.onModuleInit();
  });

  afterEach(() => runtime.onModuleDestroy());

  it('serves the second identical read from the cache', async () => {
    const reads = new Reads();
    const first = await reads.shared(WS, 'open');
    expect(await reads.shared(WS, 'open')).toEqual(first);
    expect(reads.calls).toBe(1);
    await reads.shared(WS, 'closed');
    expect(reads.calls).toBe(2);
  });

  it('keeps workspaces apart', async () => {
    const reads = new Reads();
    await reads.shared(WS, 'open');
    expect((await reads.shared(OTHER_WS, 'open'))[0]).toBe(OTHER_WS);
    expect(reads.calls).toBe(2);
  });

  it('never reads or fills the cache inside a mutation', async () => {
    transactional.cacheable = false;
    const reads = new Reads();
    await reads.shared(WS, 'open');
    await reads.shared(WS, 'open');
    expect(reads.calls).toBe(2);
  });

  it('keeps per-user entries apart and skips them when no user is known', async () => {
    const reads = new Reads();
    expect(await reads.perUser(WS)).toBe(1);
    expect(await reads.perUser(WS)).toBe(1);
    transactional.scope = { kind: 'workspace', workspaceId: WS, userId: 'u2' };
    expect(await reads.perUser(WS)).toBe(2);
    transactional.scope = null;
    expect(await reads.perUser(WS)).toBe(3);
    expect(await reads.perUser(WS)).toBe(4);
  });

  it('drops entries when a change to their entity type is announced', async () => {
    const reads = new Reads();
    await reads.shared(WS, 'open');
    await cache.invalidateTags(tagsForChange(WS, 'comment'));
    await reads.shared(WS, 'open');
    expect(reads.calls).toBe(1);
    await cache.invalidateTags(tagsForChange(WS, 'task'));
    await reads.shared(WS, 'open');
    expect(reads.calls).toBe(2);
  });
});
