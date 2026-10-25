import type { FilterOperator } from '@taskflow/shared-types';
import { escapeLike } from '../http/utils/escape-like.js';
import type { FilterValue, NormalizedNode, NormalizedQuery } from './normalize-query.js';
import type { QueryResourceDefinition } from './query-resource.decorators.js';

export interface CompiledSql {
  sql: string;
  params: Record<string, unknown>;
}

export interface CompiledOrder {
  expression: string;
  direction: 'ASC' | 'DESC';
  nulls: 'NULLS FIRST' | 'NULLS LAST';
}

/** A JSON value that looks like a number, so comparisons never fail on text such as "n/a". */
const NUMERIC_TEXT = `'^-?[0-9]+(\\.[0-9]+)?$'`;

/**
 * Turns a normalized filter into a SQL condition. Column expressions come from
 * the resource definition (developer-written); every value, JSON key and LIKE
 * pattern is a bound parameter, so input never becomes SQL.
 */
export function compileFilter(node: NormalizedNode, prefix = 'qf'): CompiledSql {
  const params: Record<string, unknown> = {};
  let counter = 0;
  const param = (value: unknown): string => {
    const name = `${prefix}${counter++}`;
    params[name] = value;
    return name;
  };

  const compile = (current: NormalizedNode): string => {
    switch (current.kind) {
      case 'and':
      case 'or':
        return `(${current.children.map(compile).join(current.kind === 'and' ? ' AND ' : ' OR ')})`;
      case 'not':
        return `(NOT COALESCE(${compile(current.child)}, FALSE))`;
      case 'condition': {
        const column = current.key === null ? current.field.column : `(${current.field.column} ->> :${param(current.key)})`;
        const numericJson = current.field.type === 'json' && typeof current.values[0] === 'number';
        const expression = numericJson ? `(CASE WHEN ${column} ~ ${NUMERIC_TEXT} THEN (${column})::numeric END)` : column;
        return condition(expression, current.op, current.values, param, current.field.type === 'date' ? '::date' : '');
      }
    }
  };

  return { sql: compile(node), params };
}

function condition(column: string, op: FilterOperator, values: FilterValue[], param: (value: unknown) => string, cast: string): string {
  const [first, second] = values;
  const one = () => `:${param(first)}${cast}`;
  switch (op) {
    case 'eq':
      return `${column} = ${one()}`;
    case 'neq':
      return `${column} IS DISTINCT FROM ${one()}`;
    case 'lt':
      return `${column} < ${one()}`;
    case 'lte':
      return `${column} <= ${one()}`;
    case 'gt':
      return `${column} > ${one()}`;
    case 'gte':
      return `${column} >= ${one()}`;
    case 'between':
      return `${column} BETWEEN :${param(first)}${cast} AND :${param(second)}${cast}`;
    case 'in':
      return `${column} IN (:...${param(values)})`;
    case 'nin':
      return `(${column} IS NULL OR ${column} NOT IN (:...${param(values)}))`;
    case 'contains':
      return `${column} ILIKE :${param(`%${escapeLike(String(first))}%`)}`;
    case 'not_contains':
      return `(${column} IS NULL OR ${column} NOT ILIKE :${param(`%${escapeLike(String(first))}%`)})`;
    case 'starts_with':
      return `${column} ILIKE :${param(`${escapeLike(String(first))}%`)}`;
    case 'ends_with':
      return `${column} ILIKE :${param(`%${escapeLike(String(first))}`)}`;
    case 'is_null':
      return `${column} IS NULL`;
    case 'is_not_null':
      return `${column} IS NOT NULL`;
  }
}

/** Free-text search across the resource's search columns. */
export function compileSearch(definition: QueryResourceDefinition, search: string, prefix = 'qs'): CompiledSql {
  const name = `${prefix}0`;
  return {
    sql: `(${definition.search.map((column) => `${column} ILIKE :${name}`).join(' OR ')})`,
    params: { [name]: `%${escapeLike(search)}%` },
  };
}

/** ORDER BY terms, ending with the primary key so paging is stable. */
export function compileOrder(definition: QueryResourceDefinition, query: NormalizedQuery): CompiledOrder[] {
  const terms: CompiledOrder[] = query.sort.map(({ field, direction }) => ({
    expression: field.sortColumn,
    direction: direction === 'desc' ? 'DESC' : 'ASC',
    nulls: 'NULLS LAST',
  }));
  terms.push({ expression: definition.idColumn, direction: 'ASC', nulls: 'NULLS LAST' });
  return terms;
}
