import { FILTER_OPERATORS, type FilterCondition, type FilterOperator, type ResourceQuery, type SortSpec } from './filter.js';

/** Query-string keys that aren't filters. */
const RESERVED = new Set(['sort', 'page', 'pageSize', 'q', 'filter']);
const OPERATORS = new Set<string>(FILTER_OPERATORS);
const LIST_OPS = new Set<string>(['in', 'nin', 'between']);

/**
 * Parses the compact form of filters used in URLs and `where` arguments:
 *
 *   status=todo                       → status eq todo
 *   status[in]=todo,done              → status in [todo, done]
 *   metadata[order_id]=6735           → metadata.order_id eq 6735
 *   metadata[order_id][gt]=100        → metadata.order_id gt 100
 *   dueDate[between]=2026-01-01,2026-01-31
 *   assigneeId[is_null]=
 *   sort=-dueDate,title  page=2  pageSize=50  q=onboarding
 *
 * A bracket that names an operator is the operator; any other bracket is a
 * JSON key. Conditions are ANDed; use the `filter` tree for OR and NOT. Field
 * names, operators and values are checked by the API against the resource.
 */
export function parseQueryString(input: string): ParsedQueryString {
  const params = splitParams(input);
  const conditions: FilterCondition[] = [];
  const result: ParsedQueryString = { conditions, sort: [] };

  for (const [rawKey, value] of params) {
    if (RESERVED.has(rawKey)) {
      if (rawKey === 'sort') result.sort = parseSort(value);
      else if (rawKey === 'page') result.page = toPositiveInt(value);
      else if (rawKey === 'pageSize') result.pageSize = toPositiveInt(value);
      else if (rawKey === 'q') result.search = value;
      continue;
    }
    const match = /^([A-Za-z][A-Za-z0-9_]*)((?:\[[^\][]*\])*)$/.exec(rawKey);
    if (!match) throw new Error(`Unrecognised filter "${rawKey}"`);
    const [, field = '', brackets = ''] = match;
    const parts = [...brackets.matchAll(/\[([^\][]*)\]/g)].map((part) => part[1] ?? '');

    let op: FilterOperator = 'eq';
    const last = parts.at(-1);
    if (last !== undefined && OPERATORS.has(last)) {
      op = last as FilterOperator;
      parts.pop();
    }
    const path = [field, ...parts].join('.');
    if (op === 'is_null' || op === 'is_not_null') conditions.push({ field: path, op });
    else if (LIST_OPS.has(op)) conditions.push({ field: path, op, values: splitList(value) });
    else conditions.push({ field: path, op, value });
  }
  return result;
}

/** The reverse of parseQueryString for AND-only conditions, so list state can live in the URL. */
export function toQueryString(query: Pick<ResourceQuery, 'sort' | 'page' | 'pageSize' | 'search'> & { conditions?: FilterCondition[] }): string {
  const params: [string, string][] = [];
  for (const condition of query.conditions ?? []) {
    const [field, ...keys] = condition.field.split('.');
    const key = `${field}${keys.map((k) => `[${k}]`).join('')}${condition.op === 'eq' ? '' : `[${condition.op}]`}`;
    params.push([key, condition.values ? condition.values.map((v) => v.replace(/,/g, '\\,')).join(',') : (condition.value ?? '')]);
  }
  if (query.sort?.length) params.push(['sort', query.sort.map((s) => `${s.direction === 'desc' ? '-' : ''}${s.field}`).join(',')]);
  if (query.page) params.push(['page', String(query.page)]);
  if (query.pageSize) params.push(['pageSize', String(query.pageSize)]);
  if (query.search) params.push(['q', query.search]);
  // Brackets stay readable; everything else is percent-encoded.
  return params.map(([key, value]) => `${encode(key).replace(/%5B/g, '[').replace(/%5D/g, ']')}=${encode(value)}`).join('&');
}

export interface ParsedQueryString {
  conditions: FilterCondition[];
  sort: SortSpec[];
  page?: number;
  pageSize?: number;
  search?: string;
}

function splitParams(input: string): [string, string][] {
  const query = input.startsWith('?') ? input.slice(1) : input;
  return query
    .split('&')
    .filter((part) => part.length > 0)
    .map((part) => {
      const index = part.indexOf('=');
      const key = index === -1 ? part : part.slice(0, index);
      const value = index === -1 ? '' : part.slice(index + 1);
      return [decode(key), decode(value)];
    });
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    throw new Error('Malformed query string');
  }
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

function parseSort(value: string): SortSpec[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.startsWith('-') ? { field: part.slice(1), direction: 'desc' } : { field: part, direction: 'asc' }));
}

/** Commas separate values; a value that itself contains a comma can be quoted with backslash: a\,b. */
function splitList(value: string): string[] {
  return value
    .split(/(?<!\\),/)
    .map((part) => part.replace(/\\,/g, ',').trim())
    .filter((part) => part.length > 0);
}

function toPositiveInt(value: string): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}
