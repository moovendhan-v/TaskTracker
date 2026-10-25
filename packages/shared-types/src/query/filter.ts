/**
 * The filter language every list in TaskFlow speaks. The API publishes, per
 * resource, which fields exist and which operators each one accepts
 * (`ResourceSchema`); clients build filters from that and never guess.
 */

export const FILTER_OPERATORS = [
  'eq',
  'neq',
  'lt',
  'lte',
  'gt',
  'gte',
  'between',
  'in',
  'nin',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'is_null',
  'is_not_null',
] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];

/** Operators that take no value. */
export const NULLARY_OPERATORS: readonly FilterOperator[] = ['is_null', 'is_not_null'];
/** Operators that take a list of values (`between` takes exactly two). */
export const LIST_OPERATORS: readonly FilterOperator[] = ['in', 'nin', 'between'];

export const FIELD_TYPES = ['string', 'text', 'number', 'boolean', 'date', 'datetime', 'enum', 'uuid', 'user', 'json'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** The operators a field type can support. A resource field may offer fewer. */
export const OPERATORS_BY_TYPE: Record<FieldType, readonly FilterOperator[]> = {
  string: ['eq', 'neq', 'contains', 'not_contains', 'starts_with', 'ends_with', 'in', 'nin', 'is_null', 'is_not_null'],
  text: ['contains', 'not_contains', 'is_null', 'is_not_null'],
  number: ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between', 'in', 'nin', 'is_null', 'is_not_null'],
  boolean: ['eq', 'is_null', 'is_not_null'],
  date: ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between', 'is_null', 'is_not_null'],
  datetime: ['lt', 'lte', 'gt', 'gte', 'between', 'is_null', 'is_not_null'],
  enum: ['eq', 'neq', 'in', 'nin', 'is_null', 'is_not_null'],
  uuid: ['eq', 'neq', 'in', 'nin', 'is_null', 'is_not_null'],
  user: ['eq', 'neq', 'in', 'nin', 'is_null', 'is_not_null'],
  json: ['eq', 'neq', 'contains', 'starts_with', 'in', 'nin', 'lt', 'lte', 'gt', 'gte', 'is_null', 'is_not_null'],
};

/** In a `user` field, this value means "whoever is asking". */
export const CURRENT_USER_TOKEN = '@me';

export const LOGIC_OPERATORS = ['and', 'or', 'not'] as const;
export type LogicOperator = (typeof LOGIC_OPERATORS)[number];

/**
 * One test on one field. Values travel as strings and the API converts them by
 * field type. A `json` field is addressed with a key: `metadata.order_id`.
 */
export interface FilterCondition {
  field: string;
  op: FilterOperator;
  value?: string | null;
  values?: string[] | null;
}

/** Combines conditions. Exactly one of `and`, `or`, `not` is set. */
export interface FilterGroup {
  and?: FilterNode[] | null;
  or?: FilterNode[] | null;
  not?: FilterNode | null;
}

export type FilterNode = FilterCondition | FilterGroup;

export type SortDirection = 'asc' | 'desc';

export interface SortSpec {
  field: string;
  direction: SortDirection;
}

/** Everything a list request can ask for. */
export interface ResourceQuery {
  filter?: FilterNode | null;
  /** The same filters as a query string, e.g. `status[in]=todo,done&metadata[order_id]=6735`. ANDed with `filter`. */
  where?: string | null;
  sort?: SortSpec[] | null;
  search?: string | null;
  page?: number | null;
  pageSize?: number | null;
}

export function isFilterGroup(node: FilterNode): node is FilterGroup {
  return 'and' in node || 'or' in node || 'not' in node;
}

/** Hard limits the API enforces on every filter. */
export const FILTER_LIMITS = {
  maxDepth: 4,
  maxConditions: 30,
  maxListValues: 100,
  maxValueLength: 500,
  maxSortFields: 3,
  maxJsonKeyLength: 64,
} as const;

export const JSON_KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
