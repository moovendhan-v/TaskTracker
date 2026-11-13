import { describe, expect, it } from 'vitest';
import { formatChatExport, type ChatExportMessage } from './chat-export.js';
import type { ChatMessageRecord } from './chat.repository.js';

const at = new Date('2026-11-12T09:30:00Z');
const record = (id: string, body: string, extra: Partial<ChatMessageRecord> = {}): ChatMessageRecord => ({
  id,
  channelId: 'c',
  parentId: null,
  authorId: 'u1',
  authorName: 'Avery',
  kind: 'user',
  body,
  taskId: null,
  replyCount: 0,
  lastReplyAt: null,
  editedAt: null,
  deletedAt: null,
  createdAt: at,
  position: { at: at.toISOString(), id },
  ...extra,
});

const messages: ChatExportMessage[] = [
  { record: record('1', 'Ship it?\n# not a heading', { editedAt: at }), files: ['plan.pdf'], replies: [{ record: record('2', 'Yes', { authorName: 'Jordan' }), files: [] }] },
  { record: record('3', 'Created #12', { kind: 'system', authorName: null }), files: [], replies: [] },
];

describe('formatChatExport', () => {
  it('writes Markdown with every line of a message quoted, replies indented and files by name', () => {
    const file = formatChatExport({ title: '#launch' }, messages, 'markdown', new Date('2026-11-13T10:00:00Z'), false);
    expect(file.fileName).toBe('launch-2026-11-13.md');
    expect(file.contentType).toBe('text/markdown');
    expect(file.content).toContain('# #launch');
    expect(file.content).toContain('**Avery** · 2026-11-12 09:30 UTC (edited)\n> Ship it?\n> # not a heading\n> 📎 plan.pdf');
    expect(file.content).toContain('    **Jordan** · 2026-11-12 09:30 UTC\n    > Yes');
    expect(file.content).toContain('**TaskFlow** ·');
    expect(file.content).toContain('2 messages');
  });

  it('writes JSON with replies nested, and says when older messages were left out', () => {
    const file = formatChatExport({ title: 'Direct message' }, messages, 'json', at, true);
    expect(file.fileName).toBe('direct-message-2026-11-12.json');
    const parsed = JSON.parse(file.content) as { truncated: boolean; messages: { author: string; files: string[]; replies: { body: string }[] }[] };
    expect(parsed.truncated).toBe(true);
    expect(parsed.messages[0]).toMatchObject({ author: 'Avery', files: ['plan.pdf'], replies: [{ body: 'Yes' }] });
    expect(parsed.messages[1]!.author).toBe('TaskFlow');
  });
});
