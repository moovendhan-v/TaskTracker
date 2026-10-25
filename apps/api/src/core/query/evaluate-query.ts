import type { FilterOperator } from '@taskflow/shared-types';
import type { FilterValue, NormalizedNode, NormalizedQuery } from './normalize-query.js';

type Row = Record<string, unknown>;

/**
 * In-memory version of the SQL a normalized query compiles to, with the same
 * semantics (neq and nin keep nulls, text matching ignores case). Used by test
 * repositories, so service tests exercise real filters without a database.
 */
export function evaluateQuery<T extends object>(rows: readonly T[], query: NormalizedQuery): { items: T[]; total: number } {
  const matching = rows.filter((row) => (query.filter ? matches(query.filter, row as Row) : true));
  const searched = query.search
    ? matching.filter((row) => query.resource.search.length > 0 && String((row as Row)['title'] ?? (row as Row)['name'] ?? '').toLowerCase().includes(query.search!.toLowerCase()))
    : matching;
  const sorted = [...searched].sort((a, b) => {
    for (const { field, direction } of query.sort) {
      const order = compare((a as Row)[field.name], (b as Row)[field.name]);
      if (order !== 0) return direction === 'desc' ? -order : order;
    }
    return compare((a as Row)['id'], (b as Row)['id']);
  });
  const start = (query.page - 1) * query.pageSize;
  return { items: sorted.slice(start, start + query.pageSize), total: sorted.length };
}

export function matches(node: NormalizedNode, row: Row): boolean {
  switch (node.kind) {
    case 'and':
      return node.children.every((child) => matches(child, row));
    case 'or':
      return node.children.some((child) => matches(child, row));
    case 'not':
      return !matches(node.child, row);
    case 'condition': {
      let value = row[node.field.name];
      if (node.key !== null) value = value && typeof value === 'object' ? (value as Row)[node.key] : undefined;
      return test(normalize(value), node.op, node.values);
    }
  }
}

function normalize(value: unknown): FilterValue | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.stringify(value);
}

function test(value: FilterValue | null, op: FilterOperator, values: FilterValue[]): boolean {
  const [first, second] = values;
  const text = (v: unknown) => String(v).toLowerCase();
  switch (op) {
    case 'is_null':
      return value === null;
    case 'is_not_null':
      return value !== null;
    case 'neq':
      return value === null || !equal(value, first);
    case 'nin':
      return value === null || !values.some((v) => equal(value, v));
  }
  if (value === null) return false;
  // Like the SQL, a numeric comparison skips values that aren't numbers (e.g. "n/a" in metadata).
  if (['lt', 'lte', 'gt', 'gte', 'between'].includes(op) && typeof first === 'number' && !isNumeric(value)) return false;
  switch (op) {
    case 'eq':
      return equal(value, first);
    case 'in':
      return values.some((v) => equal(value, v));
    case 'lt':
      return compare(value, first) < 0;
    case 'lte':
      return compare(value, first) <= 0;
    case 'gt':
      return compare(value, first) > 0;
    case 'gte':
      return compare(value, first) >= 0;
    case 'between':
      return compare(value, first) >= 0 && compare(value, second) <= 0;
    case 'contains':
      return text(value).includes(text(first));
    case 'not_contains':
      return !text(value).includes(text(first));
    case 'starts_with':
      return text(value).startsWith(text(first));
    case 'ends_with':
      return text(value).endsWith(text(first));
    default:
      return false;
  }
}

function equal(a: FilterValue, b: FilterValue | undefined): boolean {
  return String(a) === String(b);
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const numberA = Number(a);
  const numberB = Number(b);
  if (typeof a !== 'boolean' && Number.isFinite(numberA) && Number.isFinite(numberB) && String(a).trim() !== '' && String(b).trim() !== '') return numberA - numberB;
  const normal = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
  return normal(a) < normal(b) ? -1 : 1;
}

function isNumeric(value: FilterValue): boolean {
  return typeof value === 'number' || (typeof value === 'string' && /^-?[0-9]+(\.[0-9]+)?$/.test(value));
}
