import { blockConfigKeys, cleanLayoutItem, DEFAULT_LAYOUTS, validateLayoutItems, type LayoutItem } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';

const item = (patch: Partial<LayoutItem> = {}): LayoutItem => ({ id: 'a', type: 'status', x: 0, y: 0, w: 4, h: 4, ...patch });

describe('validateLayoutItems', () => {
  it('accepts the built-in default', () => {
    expect(validateLayoutItems('home', DEFAULT_LAYOUTS.home)).toEqual([]);
  });

  it('rejects unknown types, bad ids and duplicates', () => {
    expect(validateLayoutItems('home', [item({ type: 'shell' })])).toEqual(['Block 1: unknown block type']);
    expect(validateLayoutItems('home', [item({ id: 'A B' })])).toEqual(['Block 1: invalid id']);
    expect(validateLayoutItems('home', [item(), item({ x: 6 })])).toEqual(['Block 2: duplicate id']);
  });

  it('keeps blocks on the grid, sized within limits, without overlaps', () => {
    expect(validateLayoutItems('home', [item({ x: 10, w: 4 })])).toEqual(['Block 1: outside the grid']);
    expect(validateLayoutItems('home', [item({ w: 1 })])).toEqual(['Block 1: size out of range']);
    expect(validateLayoutItems('home', [item({ x: 0.5 })])).toEqual(['Block 1: position and size must be whole numbers']);
    expect(validateLayoutItems('home', [item(), item({ id: 'b', x: 2 })])).toEqual(['Blocks 1 and 2 overlap']);
  });

  it('caps the number of blocks', () => {
    const many = Array.from({ length: 41 }, (_, i) => item({ id: `b${i}`, y: i * 4 }));
    expect(validateLayoutItems('home', many)).toContain('At most 40 blocks');
  });
});

describe('block settings', () => {
  const at = { x: 0, y: 0, w: 4, h: 5 };
  it('offers each block only its own settings', () => {
    expect(blockConfigKeys('home', 'overdue-tasks')).toEqual(['title', 'accent', 'followContext', 'spaceId', 'limit', 'mine', 'assigneeIds', 'priorities', 'categories', 'fields']);
    expect(blockConfigKeys('home', 'hours-per-day')).toEqual(['title', 'accent', 'followContext', 'spaceId', 'chart']);
    expect(blockConfigKeys('project', 'recent-tasks')).toEqual(['title', 'accent', 'followContext', 'limit', 'mine', 'assigneeIds', 'priorities', 'categories', 'fields']);
    expect(blockConfigKeys('home', 'status')).toEqual(['title', 'accent', 'followContext', 'spaceId', 'includeClosed']);
    expect(blockConfigKeys('home', 'hours-by-project')).toEqual(['title', 'accent', 'followContext']);
    expect(blockConfigKeys('project', 'kpis')).toEqual(['title', 'accent', 'followContext']);
    // Nothing on the project's status card reads data, so it has nothing to follow; nor does a section.
    expect(blockConfigKeys('project', 'project-status')).toEqual(['title', 'accent']);
    expect(blockConfigKeys('home', 'section')).toEqual(['title', 'accent']);
  });

  it('checks values and refuses settings a block does not have', () => {
    const ok = { id: 'status', type: 'status', ...at, config: { title: 'Mine', accent: 'blue' as const, includeClosed: true } };
    expect(validateLayoutItems('home', [ok])).toEqual([]);
    expect(validateLayoutItems('home', [{ ...ok, config: { limit: 5 } as never }])).toEqual(["Block 1: limit isn't a setting of this block"]);
    expect(validateLayoutItems('home', [{ ...ok, config: { accent: 'neon' } as never }])).toEqual(['Block 1: unknown accent']);
    expect(validateLayoutItems('home', [{ ...ok, config: { spaceId: "x' OR 1=1" } }])).toEqual(['Block 1: spaceId must be a project id']);
    expect(validateLayoutItems('home', [{ ...ok, config: { title: '   ' } }])).toEqual(['Block 1: title must be 1 to 60 characters']);
  });

  it('stores nothing for empty settings', () => {
    expect(cleanLayoutItem({ id: 'a', type: 'status', ...at, config: { title: '', accent: undefined } })).toEqual({ id: 'a', type: 'status', ...at });
    expect(cleanLayoutItem({ id: 'a', type: 'status', ...at, config: { title: 'T', limit: null as never } })).toEqual({ id: 'a', type: 'status', ...at, config: { title: 'T' } });
  });
});

describe('task-list block filters and fields', () => {
  const list = (config: Record<string, unknown>) => validateLayoutItems('home', [{ id: 'overdue-tasks', type: 'overdue-tasks', x: 0, y: 0, w: 4, h: 7, config } as LayoutItem]);

  it('accepts filters and columns, each once and from the list', () => {
    expect(list({ mine: true, priorities: ['urgent', 'high'], fields: ['number', 'date'] })).toEqual([]);
    expect(list({ fields: [] })).toEqual([]);
    expect(list({ priorities: ['urgent', 'urgent'] })).toEqual(['Block 1: priorities: pick from the list, each once']);
    expect(list({ fields: ['email'] })).toEqual(['Block 1: fields: pick from the list, each once']);
    expect(list({ mine: 'yes' })).toEqual(['Block 1: mine must be true or false']);
  });

  it('narrows to chosen people, each once, never alongside "mine"', () => {
    expect(list({ assigneeIds: ['u_1', '0b7c7f1e-2d1a-4d6c-9a0e-2a1f3c4d5e6f'], followContext: true })).toEqual([]);
    expect(list({ assigneeIds: ['u_1', 'u_1'] })).toEqual(['Block 1: assigneeIds: up to 20 people, each once']);
    expect(list({ assigneeIds: ["x' OR 1=1"] })).toEqual(['Block 1: assigneeIds: up to 20 people, each once']);
    expect(list({ assigneeIds: Array.from({ length: 21 }, (_, index) => `u${index}`) })).toEqual(['Block 1: assigneeIds: up to 20 people, each once']);
    expect(list({ assigneeIds: ['u_1'], mine: true })).toEqual(['Block 1: pick "mine" or people, not both']);
    expect(list({ followContext: 'yes' })).toEqual(['Block 1: followContext must be true or false']);
    expect(cleanLayoutItem({ id: 'overdue-tasks', type: 'overdue-tasks', x: 0, y: 0, w: 4, h: 7, config: { assigneeIds: [], followContext: false } }).config).toBeUndefined();
  });

  it('stores "not mine" and no priorities as nothing', () => {
    expect(cleanLayoutItem({ id: 'overdue-tasks', type: 'overdue-tasks', x: 0, y: 0, w: 4, h: 7, config: { mine: false, priorities: [] } }).config).toBeUndefined();
  });
});

describe('sections and stacked tabs', () => {
  const at = (patch: Partial<LayoutItem>): LayoutItem => ({ id: 'a', type: 'status', x: 0, y: 0, w: 6, h: 4, ...patch });

  it('lets a section be one row high, but no other block', () => {
    expect(validateLayoutItems('home', [at({ id: 'section-1', type: 'section', w: 12, h: 1, config: { title: 'This week' } })])).toEqual([]);
    expect(validateLayoutItems('project', [at({ id: 'section-1', type: 'section', w: 12, h: 1 })])).toEqual([]);
    expect(validateLayoutItems('home', [at({ h: 1 })])).toEqual(['Block 1: size out of range']);
    expect(validateLayoutItems('home', [at({ id: 'section-1', type: 'section', config: { limit: 5 } as never })])).toEqual(["Block 1: limit isn't a setting of this block"]);
  });

  it('stacks other blocks of the page as tabs, each once, and keeps them when cleaned', () => {
    expect(validateLayoutItems('home', [at({ tabs: ['priority', 'workload'] })])).toEqual([]);
    expect(validateLayoutItems('home', [at({ tabs: ['status'] })])).toEqual(['Block 1: stacked tabs must be other blocks of this page, each once']);
    expect(validateLayoutItems('home', [at({ tabs: ['priority', 'priority'] })])).toEqual(['Block 1: stacked tabs must be other blocks of this page, each once']);
    expect(validateLayoutItems('home', [at({ tabs: ['phases'] })])).toEqual(['Block 1: stacked tabs must be other blocks of this page, each once']);
    expect(validateLayoutItems('home', [at({ tabs: ['section'] })])).toEqual(['Block 1: stacked tabs must be other blocks of this page, each once']);
    expect(validateLayoutItems('home', [at({ tabs: ['priority', 'workload', 'due-forecast', 'created-closed', 'hours-per-day'] })])).toEqual(['Block 1: at most 4 stacked tabs']);
    expect(cleanLayoutItem(at({ tabs: ['priority'] })).tabs).toEqual(['priority']);
    expect(cleanLayoutItem(at({ tabs: [] }))).not.toHaveProperty('tabs');
  });
});
