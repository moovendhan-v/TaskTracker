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
    expect(blockConfigKeys('home', 'overdue-tasks')).toEqual(['title', 'accent', 'spaceId', 'limit', 'mine', 'priorities', 'fields']);
    expect(blockConfigKeys('project', 'recent-tasks')).toEqual(['title', 'accent', 'limit', 'mine', 'priorities', 'fields']);
    expect(blockConfigKeys('home', 'status')).toEqual(['title', 'accent', 'spaceId', 'includeClosed']);
    expect(blockConfigKeys('home', 'hours-by-project')).toEqual(['title', 'accent']);
    expect(blockConfigKeys('project', 'kpis')).toEqual(['title', 'accent']);
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

  it('stores "not mine" and no priorities as nothing', () => {
    expect(cleanLayoutItem({ id: 'overdue-tasks', type: 'overdue-tasks', x: 0, y: 0, w: 4, h: 7, config: { mine: false, priorities: [] } }).config).toBeUndefined();
  });
});
