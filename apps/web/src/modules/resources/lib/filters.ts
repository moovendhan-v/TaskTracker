import { LIST_OPERATORS, NULLARY_OPERATORS, type FilterCondition, type FilterNode, type FilterOperator, type ResourceFieldSchema } from '@taskflow/shared-types';

/** A row in the filter builder. `key` is set for json fields (`metadata` + `order_id`). */
export interface DraftCondition {
  id: string;
  field: string;
  key: string;
  op: FilterOperator;
  value: string;
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: 'is',
  neq: 'is not',
  lt: 'before / less than',
  lte: 'on or before / at most',
  gt: 'after / more than',
  gte: 'on or after / at least',
  between: 'between',
  in: 'is any of',
  nin: 'is none of',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  is_null: 'is empty',
  is_not_null: 'is not empty',
};

export function blankCondition(field: ResourceFieldSchema): DraftCondition {
  return { id: Math.random().toString(36).slice(2), field: field.name, key: '', op: field.operators[0] ?? 'eq', value: '' };
}

/** Turns builder rows into the API's filter tree; incomplete rows are left out. */
export function toFilter(conditions: readonly DraftCondition[], logic: 'and' | 'or'): FilterNode | null {
  const built = conditions.flatMap((draft): FilterCondition[] => {
    const field = draft.key ? `${draft.field}.${draft.key.trim()}` : draft.field;
    if (NULLARY_OPERATORS.includes(draft.op)) return [{ field, op: draft.op }];
    if (LIST_OPERATORS.includes(draft.op)) {
      const values = draft.value.split(',').map((value) => value.trim()).filter(Boolean);
      return values.length ? [{ field, op: draft.op, values }] : [];
    }
    return draft.value.trim() ? [{ field, op: draft.op, value: draft.value.trim() }] : [];
  });
  if (built.length === 0) return null;
  return built.length === 1 ? (built[0] as FilterCondition) : logic === 'or' ? { or: built } : { and: built };
}

/**
 * Reads a saved filter back into builder rows. Only flat filters (one
 * condition, or one and/or group of conditions) can be edited as rows; anything
 * deeper returns null and is applied as is.
 */
export function fromFilter(filter: FilterNode | null | undefined, keyedFields: ReadonlySet<string>): { conditions: DraftCondition[]; logic: 'and' | 'or' } | null {
  if (!filter) return { conditions: [], logic: 'and' };
  const group = 'and' in filter && filter.and ? { logic: 'and' as const, nodes: filter.and } : 'or' in filter && filter.or ? { logic: 'or' as const, nodes: filter.or } : 'field' in filter ? { logic: 'and' as const, nodes: [filter] } : null;
  if (!group || group.nodes.some((node) => !('field' in node))) return null;
  const conditions = (group.nodes as FilterCondition[]).map((node, index) => {
    const dot = node.field.indexOf('.');
    const base = dot > 0 ? node.field.slice(0, dot) : node.field;
    const keyed = dot > 0 && keyedFields.has(base);
    return { id: `saved-${index}`, field: keyed ? base : node.field, key: keyed ? node.field.slice(dot + 1) : '', op: node.op, value: node.values?.join(',') ?? node.value ?? '' };
  });
  return { conditions, logic: group.logic };
}
