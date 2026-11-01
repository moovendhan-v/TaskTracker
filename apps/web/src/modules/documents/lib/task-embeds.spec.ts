import { describe, expect, it } from 'vitest';
import { mentionAt, parseTaskEmbed, splitMentions, taskEmbedToMarkdown, taskListQuery } from './task-embeds';

describe('task embeds', () => {
  it('parses task and task-list blocks, and rejects anything else', () => {
    expect(parseTaskEmbed(':::task 12')).toEqual({ kind: 'task', number: 12 });
    expect(parseTaskEmbed(':::task #12')).toEqual({ kind: 'task', number: 12 });
    expect(parseTaskEmbed(':::tasks')).toEqual({ kind: 'tasks', preset: 'open', limit: 5 });
    expect(parseTaskEmbed(':::tasks overdue limit=50')).toEqual({ kind: 'tasks', preset: 'overdue', limit: 20 });
    expect(parseTaskEmbed(':::tasks secret-admin-view')).toBeNull();
    expect(parseTaskEmbed(':::task 0')).toBeNull();
    expect(parseTaskEmbed(':::task 12; drop')).toBeNull();
    expect(parseTaskEmbed(':::cards')).toBeNull();
  });

  it('round-trips through markdown', () => {
    for (const line of [':::task 7', ':::tasks due-soon limit=3']) {
      const embed = parseTaskEmbed(line)!;
      expect(parseTaskEmbed(taskEmbedToMarkdown(embed).split('\n')[0]!)).toEqual(embed);
    }
  });

  it('builds the search for each preset', () => {
    expect(taskListQuery('overdue', '2026-11-01').filter).toEqual({
      and: [
        { field: 'statusCategory', op: 'nin', values: ['done', 'cancelled'] },
        { field: 'dueDate', op: 'lt', value: '2026-11-01' },
      ],
    });
    expect(JSON.stringify(taskListQuery('due-soon', '2026-11-01').filter)).toContain('2026-11-08');
    expect(JSON.stringify(taskListQuery('mine', '2026-11-01').filter)).toContain('@me');
  });

  it('finds inline mentions but not headings, fragments or colours', () => {
    expect(splitMentions('Fix #12 and (#7), not page#3 or #12ab or ##4')).toEqual([
      { type: 'text', value: 'Fix ' },
      { type: 'mention', number: 12 },
      { type: 'text', value: ' and (' },
      { type: 'mention', number: 7 },
      { type: 'text', value: '), not page#3 or #12ab or ##4' },
    ]);
    expect(splitMentions('#5 first')).toEqual([{ type: 'mention', number: 5 }, { type: 'text', value: ' first' }]);
  });

  it('knows when the caret is right after a #query', () => {
    expect(mentionAt('see #log', 8)).toEqual({ start: 4, query: 'log' });
    expect(mentionAt('see #', 5)).toEqual({ start: 4, query: '' });
    expect(mentionAt('see #log in', 11)).toBeNull();
    expect(mentionAt('page#3', 6)).toBeNull();
  });
});
