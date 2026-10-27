import { describe, expect, it } from 'vitest';
import { BUILT_IN_TEMPLATES } from '@taskflow/shared-types';
import { TemplateContentPolicy } from './template-content.policy.js';

const minimal = { version: 1, space: {}, statuses: [], customFields: [], folders: [], lists: [{ name: 'Tasks' }], tasks: [], docs: [] };

describe('TemplateContentPolicy', () => {
  it('accepts every built-in template unchanged in meaning', () => {
    for (const template of BUILT_IN_TEMPLATES) {
      const normalized = TemplateContentPolicy.normalize(template.content);
      expect(normalized.lists).toHaveLength(template.content.lists.length);
      expect(normalized.tasks).toHaveLength(template.content.tasks.length);
    }
  });

  it('drops unknown keys and fills defaults', () => {
    const normalized = TemplateContentPolicy.normalize({ ...minimal, lists: [{ name: ' Tasks ', extra: true }], tasks: [{ title: 'One', list: 0, assigneeId: 'x' }], hack: 1 });
    expect(normalized.lists[0]).toEqual({ name: 'Tasks', icon: null, color: null, folder: null });
    expect(normalized.tasks[0]).toMatchObject({ priority: 'none', type: 'task', subtasks: [] });
    expect(normalized).not.toHaveProperty('hack');
  });

  it('rejects references to things that do not exist or come later', () => {
    expect(() => TemplateContentPolicy.normalize({ ...minimal, tasks: [{ title: 'x', list: 3 }] })).toThrow(/tasks\[0\]\.list/);
    expect(() => TemplateContentPolicy.normalize({ ...minimal, folders: [{ name: 'a', parent: 0 }] })).toThrow(/folders\[0\]\.parent/);
  });

  it('rejects bad values: icons, colours, enums, sizes', () => {
    expect(() => TemplateContentPolicy.normalize({ ...minimal, space: { icon: '<script>' } })).toThrow(/icon/);
    expect(() => TemplateContentPolicy.normalize({ ...minimal, statuses: [{ name: 'A', color: 'red', category: 'done' }] })).toThrow(/colour/);
    expect(() => TemplateContentPolicy.normalize({ ...minimal, statuses: [{ name: 'A', color: '#ffffff', category: 'finished' }] })).toThrow(/one of/);
    expect(() => TemplateContentPolicy.normalize({ ...minimal, lists: Array.from({ length: 101 }, () => ({ name: 'x' })) })).toThrow(/at most 100/);
    expect(() => TemplateContentPolicy.normalize({ ...minimal, version: 2 })).toThrow(/version/);
  });

  it('parses exported files, wrapped or not, and refuses non-JSON', () => {
    expect(TemplateContentPolicy.parse(JSON.stringify(minimal)).lists).toHaveLength(1);
    expect(TemplateContentPolicy.parse(JSON.stringify({ name: 'Mine', content: minimal })).lists).toHaveLength(1);
    expect(() => TemplateContentPolicy.parse('{nope')).toThrow(/valid JSON/);
  });
});
