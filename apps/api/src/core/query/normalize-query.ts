import {
  CURRENT_USER_TOKEN,
  FILTER_LIMITS,
  JSON_KEY_PATTERN,
  LIST_OPERATORS,
  NULLARY_OPERATORS,
  isFilterGroup,
  parseQueryString,
  type FilterNode,
  type FilterOperator,
  type ResourceQuery,
  type SortDirection,
} from '@taskflow/shared-types';
import { DomainError } from '../domain/domain-error.js';
import type { QueryFieldDefinition, QueryResourceDefinition } from './query-resource.decorators.js';

export type FilterValue = string | number | boolean;

export type NormalizedNode =
  | { kind: 'and' | 'or'; children: NormalizedNode[] }
  | { kind: 'not'; child: NormalizedNode }
  | { kind: 'condition'; field: QueryFieldDefinition; key: string | null; op: FilterOperator; values: FilterValue[] };

export interface NormalizedSort {
  field: QueryFieldDefinition;
  direction: SortDirection;
}

export interface NormalizedQuery {
  resource: QueryResourceDefinition;
  filter: NormalizedNode | null;
  sort: NormalizedSort[];
  search: string | null;
  /** Columns the search box may match for this caller (protected ones left out). */
  searchColumns: string[];
  page: number;
  pageSize: number;
}

/** Who is asking: decides `@me` and which permission-gated fields exist for them. */
export interface QueryContext {
  userId: string | null;
  permissions: ReadonlySet<string>;
  /** Protected fields the caller may read. */
  readableFields: ReadonlySet<string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks a client's query against a resource and turns it into something the
 * SQL compiler can trust: known fields only, operators each field allows,
 * values of the right type, and the global limits. Anything else is rejected
 * with a message the client can show. Fields the caller may not see are
 * reported as unknown, so their existence isn't revealed.
 */
export function normalizeQuery(definition: QueryResourceDefinition, query: ResourceQuery | null | undefined, context: QueryContext): NormalizedQuery {
  const parsedWhere = query?.where ? parseWhere(query.where) : null;
  const roots: FilterNode[] = [];
  if (query?.filter) roots.push(query.filter);
  if (parsedWhere?.conditions.length) roots.push({ and: parsedWhere.conditions });

  const counter = { conditions: 0 };
  const children = roots.map((node) => normalizeNode(definition, node, context, 1, counter));
  const filter = children.length === 0 ? null : children.length === 1 ? (children[0] ?? null) : { kind: 'and' as const, children };

  const sortSpecs = query?.sort?.length ? query.sort : parsedWhere?.sort.length ? parsedWhere.sort : definition.defaultSort;
  if (sortSpecs.length > FILTER_LIMITS.maxSortFields) throw DomainError.invalid(`Sort by at most ${FILTER_LIMITS.maxSortFields} fields`);
  const sort = sortSpecs.map((spec) => {
    const field = visibleField(definition, spec.field, context);
    if (!field.sortable) throw DomainError.invalid(`Can't sort by ${spec.field}`);
    if (spec.direction !== 'asc' && spec.direction !== 'desc') throw DomainError.invalid('Sort direction must be asc or desc');
    return { field, direction: spec.direction };
  });

  const search = (query?.search ?? parsedWhere?.search ?? '').trim();
  if (search.length > FILTER_LIMITS.maxValueLength) throw DomainError.invalid('Search text is too long');
  // Searching a protected column would let someone probe values they may not read.
  const searchColumns = definition.search.filter((entry) => !entry.field || context.readableFields.has(entry.field)).map((entry) => entry.column);
  if (search && searchColumns.length === 0) throw DomainError.invalid(`${definition.label} can't be searched`);

  const page = query?.page ?? parsedWhere?.page ?? 1;
  const pageSize = query?.pageSize ?? parsedWhere?.pageSize ?? definition.defaultPageSize;
  if (!Number.isInteger(page) || page < 1 || page > 100_000) throw DomainError.invalid('Page must be a positive whole number');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > definition.maxPageSize) {
    throw DomainError.invalid(`Page size must be between 1 and ${definition.maxPageSize}`);
  }

  return { resource: definition, filter, sort, search: search || null, searchColumns, page, pageSize };
}

function parseWhere(where: string): ReturnType<typeof parseQueryString> {
  if (where.length > 4_000) throw DomainError.invalid('Filter is too long');
  try {
    return parseQueryString(where);
  } catch (error) {
    throw DomainError.invalid(error instanceof Error ? error.message : 'Malformed filter');
  }
}

function normalizeNode(
  definition: QueryResourceDefinition,
  node: FilterNode,
  context: QueryContext,
  depth: number,
  counter: { conditions: number },
): NormalizedNode {
  if (depth > FILTER_LIMITS.maxDepth) throw DomainError.invalid(`Filters can nest at most ${FILTER_LIMITS.maxDepth} levels`);
  if (!node || typeof node !== 'object') throw DomainError.invalid('Malformed filter');

  if (isFilterGroup(node)) {
    const kinds = (['and', 'or', 'not'] as const).filter((kind) => node[kind] !== undefined && node[kind] !== null);
    if (kinds.length !== 1) throw DomainError.invalid('A filter group needs exactly one of and, or, not');
    const kind = kinds[0] as 'and' | 'or' | 'not';
    if (!definition.logic.includes(kind)) throw DomainError.invalid(`${definition.label} filters don't support "${kind}"`);
    if (kind === 'not') return { kind, child: normalizeNode(definition, node.not as FilterNode, context, depth + 1, counter) };
    const items = node[kind] as FilterNode[];
    if (!Array.isArray(items) || items.length === 0) throw DomainError.invalid(`"${kind}" needs at least one filter`);
    return { kind, children: items.map((child) => normalizeNode(definition, child, context, depth + 1, counter)) };
  }

  counter.conditions += 1;
  if (counter.conditions > FILTER_LIMITS.maxConditions) throw DomainError.invalid(`Use at most ${FILTER_LIMITS.maxConditions} filters`);

  const [fieldName = '', ...keyParts] = String(node.field ?? '').split('.');
  const field = visibleField(definition, fieldName, context);
  const key = keyParts.length > 0 ? keyParts.join('.') : null;
  if (field.type === 'json') {
    if (!key || !JSON_KEY_PATTERN.test(key)) throw DomainError.invalid(`Filter ${field.name} by a key, e.g. ${field.name}.order_id`);
  } else if (key !== null) {
    throw DomainError.invalid(`Unknown field ${String(node.field)}`);
  }

  const op = node.op;
  if (!field.operators.includes(op)) throw DomainError.invalid(`${field.label} can't be filtered with "${String(op)}"`);
  return { kind: 'condition', field, key, op, values: convertValues(field, op, node.value, node.values, context) };
}

function visibleField(definition: QueryResourceDefinition, name: string, context: QueryContext): QueryFieldDefinition {
  const field = definition.fields.get(name);
  if (!field || !isVisible(field, context)) throw DomainError.invalid(`Unknown field ${name.slice(0, 64)}`);
  return field;
}

function convertValues(
  field: QueryFieldDefinition,
  op: FilterOperator,
  value: string | null | undefined,
  values: string[] | null | undefined,
  context: QueryContext,
): FilterValue[] {
  if (NULLARY_OPERATORS.includes(op)) return [];

  let raw: string[];
  if (LIST_OPERATORS.includes(op)) {
    raw = values ?? (value !== undefined && value !== null ? [value] : []);
    if (op === 'between' && raw.length !== 2) throw DomainError.invalid(`"between" needs exactly two values for ${field.label}`);
    if (raw.length === 0) throw DomainError.invalid(`Give at least one value for ${field.label}`);
    if (raw.length > FILTER_LIMITS.maxListValues) throw DomainError.invalid(`Use at most ${FILTER_LIMITS.maxListValues} values for ${field.label}`);
  } else {
    if (value === undefined || value === null) throw DomainError.invalid(`Give a value for ${field.label}`);
    raw = [value];
  }
  return raw.map((item) => convertValue(field, op, item, context));
}

function convertValue(field: QueryFieldDefinition, op: FilterOperator, value: string, context: QueryContext): FilterValue {
  if (typeof value !== 'string') throw DomainError.invalid(`Values for ${field.label} must be text`);
  if (value.length > FILTER_LIMITS.maxValueLength) throw DomainError.invalid(`A value for ${field.label} is too long`);
  const invalid = () => DomainError.invalid(`"${value.slice(0, 40)}" is not a valid ${field.label.toLowerCase()}`);

  switch (field.type) {
    case 'string':
    case 'text':
      return value;
    case 'number': {
      const number = Number(value);
      if (value.trim() === '' || !Number.isFinite(number)) throw invalid();
      return number;
    }
    case 'boolean':
      if (value !== 'true' && value !== 'false') throw invalid();
      return value === 'true';
    case 'date':
      if (!DATE.test(value) || Number.isNaN(Date.parse(value))) throw invalid();
      return value;
    case 'datetime': {
      const time = Date.parse(value);
      if (Number.isNaN(time)) throw invalid();
      return new Date(time).toISOString();
    }
    case 'enum':
      if (!field.options?.some((option) => option.value === value)) throw invalid();
      return value;
    case 'uuid':
      if (!UUID.test(value)) throw invalid();
      return value;
    case 'user':
      if (value === CURRENT_USER_TOKEN) {
        if (!context.userId) throw invalid();
        return context.userId;
      }
      // Better Auth ids aren't UUIDs; allow their alphabet only.
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(value)) throw invalid();
      return value;
    case 'json':
      if (['lt', 'lte', 'gt', 'gte'].includes(op)) {
        const number = Number(value);
        if (value.trim() === '' || !Number.isFinite(number)) throw invalid();
        return number;
      }
      return value;
  }
}

/** Whether a caller may see a field at all: its permission and its protected-field rule. */
export function isVisible(field: QueryFieldDefinition, context: Pick<QueryContext, 'permissions' | 'readableFields'>): boolean {
  if (field.requires && !context.permissions.has(field.requires)) return false;
  return !field.protectedField || context.readableFields.has(field.protectedField);
}
