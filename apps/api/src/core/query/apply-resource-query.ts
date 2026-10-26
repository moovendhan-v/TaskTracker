import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { compileFilter, compileOrder, compileSearch } from './compile-query.js';
import type { NormalizedQuery } from './normalize-query.js';

export interface ResourcePage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Adds a normalized query's filter, search, sort and paging to a query builder
 * that already limits rows to the caller's scope (workspace, list...), then
 * loads one page and the total.
 */
export async function pageWithResourceQuery<T extends ObjectLiteral>(builder: SelectQueryBuilder<T>, query: NormalizedQuery): Promise<ResourcePage<T>> {
  applyResourceQuery(builder, query);
  const [items, total] = await builder.getManyAndCount();
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export function applyResourceQuery<T extends ObjectLiteral>(builder: SelectQueryBuilder<T>, query: NormalizedQuery): SelectQueryBuilder<T> {
  const definition = query.resource;
  if (query.filter) {
    const { sql, params } = compileFilter(query.filter);
    builder.andWhere(sql, params);
  }
  if (query.search) {
    const { sql, params } = compileSearch(query.searchColumns, query.search);
    builder.andWhere(sql, params);
  }
  compileOrder(definition, query).forEach((term, index) => {
    if (index === 0) builder.orderBy(term.expression, term.direction, term.nulls);
    else builder.addOrderBy(term.expression, term.direction, term.nulls);
  });
  return builder.skip((query.page - 1) * query.pageSize).take(query.pageSize);
}

/**
 * Like pageWithResourceQuery, for builders that select raw columns (joins with
 * aliases): counts first, then loads the page with OFFSET/LIMIT.
 */
export async function pageRawWithResourceQuery<Row, T extends ObjectLiteral = ObjectLiteral>(
  builder: SelectQueryBuilder<T>,
  query: NormalizedQuery,
): Promise<{ rows: Row[]; total: number }> {
  applyResourceQuery(builder, query);
  // Sequential on purpose: an operation's queries share one transaction connection.
  const total = await builder.clone().skip(undefined).take(undefined).orderBy().getCount();
  const rows = await builder
    .skip(undefined)
    .take(undefined)
    .offset((query.page - 1) * query.pageSize)
    .limit(query.pageSize)
    .getRawMany<Row>();
  return { rows, total };
}
