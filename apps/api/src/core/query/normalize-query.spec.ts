import { describe, expect, it } from 'vitest';
import { parseQueryString, toQueryString } from '@taskflow/shared-types';
import { DomainError } from '../domain/domain-error.js';
import { compileFilter, compileOrder } from './compile-query.js';
import { evaluateQuery } from './evaluate-query.js';
import { normalizeQuery, type QueryContext } from './normalize-query.js';
import { queryResource } from './query-resource.decorators.js';
import './query.spec-fixtures.js';

const things = queryResource('spec_things');
const context: QueryContext = { userId: 'user_1', permissions: new Set(['task.view']) };

function invalid(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    return (error as Error).message;
  }
  throw new Error('expected a DomainError');
}

describe('parseQueryString', () => {
  it('reads the compact URL form, including JSON keys', () => {
    const parsed = parseQueryString('status[in]=open,closed&metadata[order_id]=6735&metadata[total][gt]=100&ownerId[is_null]=&sort=-points,name&page=2&pageSize=25&q=plan');
    expect(parsed.conditions).toEqual([
      { field: 'status', op: 'in', values: ['open', 'closed'] },
      { field: 'metadata.order_id', op: 'eq', value: '6735' },
      { field: 'metadata.total', op: 'gt', value: '100' },
      { field: 'ownerId', op: 'is_null' },
    ]);
    expect(parsed.sort).toEqual([
      { field: 'points', direction: 'desc' },
      { field: 'name', direction: 'asc' },
    ]);
    expect(parsed).toMatchObject({ page: 2, pageSize: 25, search: 'plan' });
  });

  it('round-trips through toQueryString, keeping commas inside values', () => {
    const conditions = [
      { field: 'name', op: 'in' as const, values: ['a,b', 'c'] },
      { field: 'metadata.order_id', op: 'eq' as const, value: '6735' },
    ];
    const text = toQueryString({ conditions, sort: [{ field: 'name', direction: 'desc' }] });
    expect(parseQueryString(text).conditions).toEqual(conditions);
  });
});

describe('normalizeQuery', () => {
  it('applies the defaults', () => {
    const query = normalizeQuery(things, {}, context);
    expect(query).toMatchObject({ filter: null, search: null, page: 1, pageSize: 50 });
    expect(query.sort.map((s) => [s.field.name, s.direction])).toEqual([['name', 'asc']]);
  });

  it('converts values by field type and resolves @me', () => {
    const query = normalizeQuery(
      things,
      {
        filter: {
          and: [
            { field: 'points', op: 'between', values: ['1', '8'] },
            { field: 'ownerId', op: 'eq', value: '@me' },
            { field: 'metadata.total', op: 'gte', value: '10.5' },
          ],
        },
      },
      context,
    );
    expect(query.filter).toMatchObject({
      kind: 'and',
      children: [
        { kind: 'condition', op: 'between', values: [1, 8] },
        { kind: 'condition', op: 'eq', values: ['user_1'] },
        { kind: 'condition', key: 'total', values: [10.5] },
      ],
    });
  });

  it('combines a filter tree and a where string with AND', () => {
    const query = normalizeQuery(things, { filter: { field: 'status', op: 'eq', value: 'open' }, where: 'name[contains]=plan' }, context);
    expect(query.filter).toMatchObject({ kind: 'and', children: [{ kind: 'condition' }, { kind: 'and' }] });
  });

  it('rejects unknown fields, unsupported operators and bad values', () => {
    expect(invalid(() => normalizeQuery(things, { filter: { field: 'secret', op: 'eq', value: 'x' } }, context))).toMatch(/Unknown field secret/);
    expect(invalid(() => normalizeQuery(things, { filter: { field: 'status', op: 'contains', value: 'op' } }, context))).toMatch(/can't be filtered/);
    expect(invalid(() => normalizeQuery(things, { filter: { field: 'status', op: 'eq', value: 'archived' } }, context))).toMatch(/not a valid/);
    expect(invalid(() => normalizeQuery(things, { filter: { field: 'points', op: 'eq', value: 'ten' } }, context))).toMatch(/not a valid/);
    expect(invalid(() => normalizeQuery(things, { filter: { field: 'due', op: 'eq', value: '2026-13-45' } }, context))).toMatch(/not a valid/);
    expect(invalid(() => normalizeQuery(things, { filter: { field: 'points', op: 'between', values: ['1'] } }, context))).toMatch(/exactly two/);
    expect(invalid(() => normalizeQuery(things, { filter: { field: 'metadata', op: 'eq', value: '1' } }, context))).toMatch(/by a key/);
    expect(invalid(() => normalizeQuery(things, { filter: { field: 'metadata.bad key', op: 'eq', value: '1' } }, context))).toMatch(/by a key/);
    expect(invalid(() => normalizeQuery(things, { filter: { field: 'name.sub', op: 'eq', value: '1' } }, context))).toMatch(/Unknown field/);
  });

  it('hides permission-gated fields from callers without the permission', () => {
    expect(invalid(() => normalizeQuery(things, { filter: { field: 'cost', op: 'gt', value: '1' } }, context))).toMatch(/Unknown field cost/);
    expect(invalid(() => normalizeQuery(things, { sort: [{ field: 'cost', direction: 'asc' }] }, context))).toMatch(/Unknown field cost/);
    const auditor = { ...context, permissions: new Set(['task.view', 'audit.view']) };
    expect(normalizeQuery(things, { filter: { field: 'cost', op: 'gt', value: '1' } }, auditor).filter).not.toBeNull();
  });

  it('enforces the limits and the logic a resource allows', () => {
    let deep: object = { field: 'name', op: 'eq', value: 'x' };
    for (let i = 0; i < 5; i++) deep = { and: [deep] };
    expect(invalid(() => normalizeQuery(things, { filter: deep as never }, context))).toMatch(/nest at most/);

    const many = Array.from({ length: 31 }, () => ({ field: 'name', op: 'eq' as const, value: 'x' }));
    expect(invalid(() => normalizeQuery(things, { filter: { or: many } }, context))).toMatch(/at most 30/);
    expect(invalid(() => normalizeQuery(things, { pageSize: 51 }, context))).toMatch(/between 1 and 50/);
    expect(invalid(() => normalizeQuery(things, { filter: { and: [], or: [] } }, context))).toMatch(/exactly one/);
    expect(invalid(() => normalizeQuery(queryResource('spec_and_only'), { filter: { or: [{ field: 'name', op: 'eq', value: 'x' }] } }, context))).toMatch(/don't support "or"/);
  });
});

describe('compileFilter', () => {
  it('binds every value, key and pattern as a parameter', () => {
    const query = normalizeQuery(
      things,
      {
        filter: {
          or: [
            { field: 'name', op: 'contains', value: "50%_off'; DROP TABLE t;--" },
            { not: { field: 'status', op: 'in', values: ['open', 'closed'] } },
            { field: 'metadata.order_id', op: 'eq', value: '6735' },
            { field: 'metadata.total', op: 'gt', value: '100' },
          ],
        },
      },
      context,
    );
    const { sql, params } = compileFilter(query.filter!);
    expect(sql).toBe(
      "(t.name ILIKE :qf0 OR (NOT COALESCE(t.status IN (:...qf1), FALSE)) OR (t.metadata ->> :qf2) = :qf3 OR (CASE WHEN (t.metadata ->> :qf4) ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ((t.metadata ->> :qf4))::numeric END) > :qf5)",
    );
    expect(params).toEqual({ qf0: "%50\\%\\_off'; DROP TABLE t;--%", qf1: ['open', 'closed'], qf2: 'order_id', qf3: '6735', qf4: 'total', qf5: 100 });
    expect(sql).not.toContain('DROP');
  });

  it('keeps rows with no value when excluding values', () => {
    const query = normalizeQuery(things, { filter: { field: 'status', op: 'nin', values: ['closed'] } }, context);
    expect(compileFilter(query.filter!).sql).toBe('(t.status IS NULL OR t.status NOT IN (:...qf0))');
  });

  it('orders by the requested fields, then the id', () => {
    const query = normalizeQuery(things, { sort: [{ field: 'points', direction: 'desc' }] }, context);
    expect(compileOrder(things, query)).toEqual([
      { expression: 't.points', direction: 'DESC', nulls: 'NULLS LAST' },
      { expression: 't.id', direction: 'ASC', nulls: 'NULLS LAST' },
    ]);
  });
});

describe('evaluateQuery', () => {
  const rows = [
    { id: '1', name: 'Plan launch', status: 'open', points: 3, ownerId: 'user_1', metadata: { order_id: '6735', total: 120 } },
    { id: '2', name: 'Write post', status: 'closed', points: 8, ownerId: null, metadata: { total: 'n/a' } },
    { id: '3', name: 'Ship it', status: null, points: 5, ownerId: 'user_2', metadata: {} },
  ];
  const run = (where: string, extra: object = {}) => evaluateQuery(rows, normalizeQuery(things, { where, ...extra }, context)).items.map((r) => r.id);

  it('filters like the SQL would', () => {
    expect(run('metadata[order_id]=6735')).toEqual(['1']);
    expect(run('metadata[total][gt]=100')).toEqual(['1']);
    expect(run('status[nin]=closed')).toEqual(['1', '3']);
    expect(run('status[neq]=open')).toEqual(['3', '2']);
    expect(run('ownerId=@me')).toEqual(['1']);
    expect(run('name[contains]=PLAN')).toEqual(['1']);
    expect(run('points[between]=4,8', { sort: [{ field: 'points', direction: 'desc' }] })).toEqual(['2', '3']);
    expect(run('ownerId[is_null]=')).toEqual(['2']);
  });

  it('supports OR and NOT groups', () => {
    const query = normalizeQuery(things, { filter: { or: [{ field: 'points', op: 'gt', value: '6' }, { not: { field: 'ownerId', op: 'is_not_null' } }] } }, context);
    expect(evaluateQuery(rows, query).items.map((r) => r.id)).toEqual(['2']);
  });
});
