import type { ChatMessageResponse } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';
import { channelLabel, dayLabel, toRows } from './chat-display';

const message = (id: string, authorId: string, createdAt: string, kind: 'user' | 'system' = 'user'): ChatMessageResponse => ({
  id,
  channelId: 'c',
  parentId: null,
  authorId,
  authorName: authorId,
  kind,
  body: id,
  taskId: null,
  replyCount: 0,
  lastReplyAt: null,
  editedAt: null,
  deleted: false,
  createdAt,
  reactions: [],
});

describe('chat display', () => {
  it('labels channels and direct messages', () => {
    expect(channelLabel({ kind: 'public', name: 'platform', dmMembers: [] })).toBe('#platform');
    expect(channelLabel({ kind: 'dm', name: null, dmMembers: [{ id: '1', name: 'Dev' }] })).toBe('Dev');
    const many = ['A', 'B', 'C', 'D', 'E'].map((name) => ({ id: name, name }));
    expect(channelLabel({ kind: 'dm', name: null, dmMembers: many })).toBe('A, B and 3 others');
  });

  it('groups messages by author within five minutes, and splits days', () => {
    const now = new Date('2026-11-02T15:00:00');
    const rows = toRows(
      [
        message('a', 'u1', '2026-11-01T10:00:00'),
        message('b', 'u1', '2026-11-02T09:00:00'),
        message('c', 'u1', '2026-11-02T09:03:00'),
        message('d', 'u2', '2026-11-02T09:04:00'),
        message('e', 'u2', '2026-11-02T09:20:00'),
        message('f', 'u2', '2026-11-02T09:21:00', 'system'),
      ],
      now,
    );
    expect(rows.map((row) => [row.message.id, row.head, row.day])).toEqual([
      ['a', true, 'Yesterday'],
      ['b', true, 'Today'],
      ['c', false, null],
      ['d', true, null],
      ['e', true, null],
      ['f', true, null],
    ]);
    expect(dayLabel('2026-11-02T01:00:00', now)).toBe('Today');
  });
});
