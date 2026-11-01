import type { FilterNode, ResourceQuery } from '@taskflow/shared-types';

/**
 * Tasks inside documents (v2 Features #16a), all plain markdown so docs stay portable:
 *
 *   see #12 for details        → an inline chip for task 12 (status, number, title)
 *   :::task 12                 → a card for task 12
 *   :::
 *   :::tasks overdue limit=5   → a live list: open | mine | overdue | due-soon
 *   :::
 *
 * Everything is fetched with the reader's own access; a task they can't see shows
 * as "not available" rather than leaking its title.
 */

export const TASK_LIST_PRESETS = ['open', 'mine', 'overdue', 'due-soon'] as const;
export type TaskListPreset = (typeof TASK_LIST_PRESETS)[number];

export const TASK_LIST_LABELS: Record<TaskListPreset, string> = {
  open: 'Open tasks',
  mine: 'My open tasks',
  overdue: 'Overdue tasks',
  'due-soon': 'Due in the next 7 days',
};

export const TASK_LIST_LIMIT = { default: 5, max: 20 } as const;
const TASK_NUMBER_MAX = 999_999;

export type TaskEmbed = { kind: 'task'; number: number } | { kind: 'tasks'; preset: TaskListPreset; limit: number };

const isPreset = (value: string): value is TaskListPreset => (TASK_LIST_PRESETS as readonly string[]).includes(value);

/** Reads the opening line of a `:::task` / `:::tasks` block; null when it isn't one (or is malformed). */
export function parseTaskEmbed(line: string): TaskEmbed | null {
  const single = /^:::task\s+#?(\d{1,6})\s*$/.exec(line.trim());
  if (single) {
    const number = Number(single[1]);
    return number >= 1 && number <= TASK_NUMBER_MAX ? { kind: 'task', number } : null;
  }
  const list = /^:::tasks(?:\s+([a-z-]+))?(?:\s+limit=(\d{1,3}))?\s*$/.exec(line.trim());
  if (!list) return null;
  const preset = list[1] ?? 'open';
  if (!isPreset(preset)) return null;
  const limit = Math.min(TASK_LIST_LIMIT.max, Math.max(1, Number(list[2] ?? TASK_LIST_LIMIT.default)));
  return { kind: 'tasks', preset, limit };
}

export function taskEmbedToMarkdown(embed: TaskEmbed): string {
  return embed.kind === 'task' ? `:::task ${embed.number}\n:::` : `:::tasks ${embed.preset} limit=${embed.limit}\n:::`;
}

const closed: FilterNode = { field: 'statusCategory', op: 'nin', values: ['done', 'cancelled'] };

/** The search behind a live list. `today` is yyyy-mm-dd in the reader's calendar. */
export function taskListQuery(preset: TaskListPreset, today: string): Omit<ResourceQuery, 'page' | 'pageSize'> {
  const inAWeek = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  const byDue = [{ field: 'dueDate', direction: 'asc' as const }];
  switch (preset) {
    case 'mine':
      return { filter: { and: [closed, { field: 'assigneeId', op: 'eq', value: '@me' }] }, sort: byDue };
    case 'overdue':
      return { filter: { and: [closed, { field: 'dueDate', op: 'lt', value: today }] }, sort: byDue };
    case 'due-soon':
      return { filter: { and: [closed, { field: 'dueDate', op: 'between', values: [today, inAWeek] }] }, sort: byDue };
    default:
      return { filter: closed, sort: [{ field: 'updatedAt', direction: 'desc' }] };
  }
}

/**
 * Inline mentions: `#123` after the start of the text or a space / opening bracket,
 * and not followed by a word character. Leaves headings (`# x`), URL fragments
 * (`page#12`) and colours (`#12ab34`) alone.
 */
export const TASK_MENTION = /(^|[\s(])#(\d{1,6})(?![\w#])/g;

export type MentionPart = { type: 'text'; value: string } | { type: 'mention'; number: number };

export function splitMentions(text: string): MentionPart[] {
  const parts: MentionPart[] = [];
  let last = 0;
  for (const match of text.matchAll(TASK_MENTION)) {
    const start = (match.index ?? 0) + match[1]!.length;
    if (start > last) parts.push({ type: 'text', value: text.slice(last, start) });
    parts.push({ type: 'mention', number: Number(match[2]) });
    last = start + 1 + match[2]!.length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}

/**
 * The `#query` being typed just before the caret, for autocomplete; null when the
 * caret isn't right after one. `query` may be empty (just typed `#`).
 */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const match = /(^|[\s(])#([\w-]{0,40})$/.exec(text.slice(0, caret));
  if (!match) return null;
  return { start: caret - match[2]!.length - 1, query: match[2]! };
}
