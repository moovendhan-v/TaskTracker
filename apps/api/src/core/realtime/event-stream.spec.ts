import { describe, expect, it } from 'vitest';
import { EventStream } from './event-stream.js';
import { parseRealtimeEvent, type RealtimeEvent } from './realtime-event.js';

const event = (entityId: string, workspaceId = '4f6f3c43-6a9a-4c1b-9d1a-2a7e6bb2b2c1'): RealtimeEvent => ({
  type: 'task.updated',
  workspaceId,
  entityType: 'task',
  entityId,
  actorId: 'user-1',
  recipientId: null,
  occurredAt: '2026-10-23T09:00:00.000Z',
});

describe('EventStream', () => {
  it('delivers matching events in order, including ones sent before next()', async () => {
    const stream = new EventStream();
    const sub = stream.subscribe((e) => e.entityId !== 'skip');
    stream.dispatch(event('a'));
    stream.dispatch(event('skip'));
    const pending = sub.next();
    expect((await pending).value?.entityId).toBe('a');
    const waiting = sub.next();
    stream.dispatch(event('b'));
    expect((await waiting).value?.entityId).toBe('b');
  });

  it('removes the subscriber when it returns', async () => {
    const stream = new EventStream();
    const sub = stream.subscribe(() => true);
    expect(stream.subscriberCount).toBe(1);
    const waiting = sub.next();
    await sub.return?.();
    expect(stream.subscriberCount).toBe(0);
    expect((await waiting).done).toBe(true);
  });

  it('keeps at most 100 queued events for a slow subscriber', async () => {
    const stream = new EventStream();
    const sub = stream.subscribe(() => true);
    for (let i = 0; i < 150; i++) stream.dispatch(event(String(i)));
    expect((await sub.next()).value?.entityId).toBe('50');
  });
});

describe('parseRealtimeEvent', () => {
  it('accepts a well-formed event and drops anything else', () => {
    expect(parseRealtimeEvent(JSON.stringify(event('a')))).toMatchObject({ entityId: 'a' });
    expect(parseRealtimeEvent('not json')).toBeNull();
    expect(parseRealtimeEvent(JSON.stringify({ ...event('a'), type: 'task.exploded' }))).toBeNull();
    expect(parseRealtimeEvent(JSON.stringify({ ...event('a'), workspaceId: 'x' }))).toBeNull();
  });
});
