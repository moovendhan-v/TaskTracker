import { describe, expect, it } from 'vitest';
import { domainEvent } from './domain-event.js';
import { InProcessEventBus } from './in-process-event-bus.js';

describe('InProcessEventBus', () => {
  it('runs handlers one after another, in the order they subscribed', async () => {
    const bus = new InProcessEventBus();
    const calls: string[] = [];
    bus.subscribe(async () => {
      await new Promise((done) => setTimeout(done, 5));
      calls.push('first');
    });
    bus.subscribe(async () => {
      calls.push('second');
    });
    await bus.publish(domainEvent('task', 'created', { workspaceId: 'w', entityId: 't', actorId: 'u' }));
    expect(calls).toEqual(['first', 'second']);
  });

  it('lets a failing handler fail the publish, so the caller rolls back', async () => {
    const bus = new InProcessEventBus();
    bus.subscribe(async () => {
      throw new Error('nope');
    });
    await expect(bus.publish(domainEvent('task', 'deleted', { workspaceId: 'w', entityId: 't', actorId: 'u' }))).rejects.toThrow('nope');
  });
});
