import { describe, expect, it } from 'vitest';
import { narrowingOf } from './configured-block';

const sam = { kind: 'person', id: 'u_sam', name: 'Sam' } as const;
const portal = { kind: 'project', id: '0b7c7f1e-2d1a-4d6c-9a0e-2a1f3c4d5e6f', name: 'Client portal' } as const;

describe('narrowingOf', () => {
  it('reads the page as is when the block has no data settings', () => {
    expect(narrowingOf(undefined)).toBeNull();
    expect(narrowingOf({ title: 'Mine' })).toBeNull();
  });

  it('narrows to chosen people', () => {
    expect(narrowingOf({ assigneeIds: ['u_1', 'u_2'] })).toMatchObject({ userIds: ['u_1', 'u_2'] });
  });

  it('ignores the page selection unless the block follows it', () => {
    expect(narrowingOf({ priorities: ['urgent'] }, sam)).toEqual({ priorities: ['urgent'], spaceId: undefined, mine: undefined, userIds: undefined, categories: undefined });
    expect(narrowingOf({}, sam)).toBeNull();
  });

  it('a followed person replaces the block’s own people, "mine" included', () => {
    expect(narrowingOf({ followContext: true, mine: true }, sam)).toMatchObject({ userIds: ['u_sam'], mine: undefined });
    expect(narrowingOf({ followContext: true, assigneeIds: ['u_1'] }, sam)).toMatchObject({ userIds: ['u_sam'] });
  });

  it('a followed project replaces the block’s own project, and nothing is picked means its own settings', () => {
    expect(narrowingOf({ followContext: true, spaceId: 'other' }, portal)).toMatchObject({ spaceId: portal.id });
    expect(narrowingOf({ followContext: true, mine: true }, null)).toMatchObject({ mine: true, userIds: undefined });
    expect(narrowingOf({ followContext: true }, null)).toBeNull();
  });
});
