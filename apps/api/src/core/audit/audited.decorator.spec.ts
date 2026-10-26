import type { ModuleRef } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DomainEvent } from '../events/domain-event.js';
import { Announces } from '../events/announces.decorator.js';
import { EventBus } from '../events/event-bus.port.js';
import type { Actor } from '../http/types/authenticated-request.js';
import { DecoratorRuntime } from '../runtime/decorator-runtime.js';
import { workspaceFromArg } from '../runtime/change-target.js';
import { AuditLogger, type AuditEntry } from './audit-logger.port.js';
import { Audited } from './audited.decorator.js';

const actor: Actor = { userId: 'u1', platformRole: 'USER', ip: '127.0.0.1' };

class Service {
  @Audited('thing.update', { ...workspaceFromArg, metadata: (thing: { name: string }) => ({ name: thing.name }) })
  @Announces('space.updated', workspaceFromArg)
  async update(_actor: Actor, _workspaceId: string, name: string): Promise<{ id: string; name: string }> {
    if (!name) throw new Error('invalid');
    return { id: 't1', name };
  }
}

describe('@Audited and @Announces', () => {
  const entries: AuditEntry[] = [];
  const events: DomainEvent[] = [];
  let runtime: DecoratorRuntime;

  beforeEach(() => {
    entries.length = 0;
    events.length = 0;
    const logger = { record: (_actor: Actor, entry: AuditEntry) => Promise.resolve(void entries.push(entry)) };
    const bus = { publish: (event: DomainEvent) => Promise.resolve(void events.push(event)), subscribe: () => undefined };
    const ref = { get: (token: unknown) => (token === AuditLogger ? logger : token === EventBus ? bus : null) } as unknown as ModuleRef;
    runtime = new DecoratorRuntime(ref);
    runtime.onModuleInit();
  });

  afterEach(() => runtime.onModuleDestroy());

  it('records an audit entry and an event after the method succeeds', async () => {
    await new Service().update(actor, 'w1', 'Roadmap');
    expect(entries).toEqual([{ action: 'thing.update', targetType: 'thing', targetId: 't1', workspaceId: 'w1', metadata: { name: 'Roadmap' } }]);
    expect(events).toMatchObject([{ type: 'space.updated', workspaceId: 'w1', entityId: 't1', actorId: 'u1' }]);
  });

  it('records nothing when the method fails', async () => {
    await expect(new Service().update(actor, 'w1', '')).rejects.toThrow('invalid');
    expect(entries).toEqual([]);
    expect(events).toEqual([]);
  });

  it('refuses to run without an actor, rather than skipping the audit', async () => {
    await expect(new Service().update(null as unknown as Actor, 'w1', 'x')).rejects.toThrow('actor');
  });

  it('refuses to run before the app starts, rather than skipping the audit', async () => {
    runtime.onModuleDestroy();
    await expect(new Service().update(actor, 'w1', 'x')).rejects.toThrow('needs the Nest application');
  });
});
