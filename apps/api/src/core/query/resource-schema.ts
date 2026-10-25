import { FILTER_LIMITS, type EnumOption, type ResourceSchema } from '@taskflow/shared-types';
import type { QueryResourceDefinition } from './query-resource.decorators.js';

/**
 * The client-facing description of a resource for one caller: fields they may
 * not see are left out. `dynamicOptions` replaces enum options that depend on
 * the workspace (custom statuses, for example).
 */
export function describeResource(
  definition: QueryResourceDefinition,
  permissions: ReadonlySet<string>,
  dynamicOptions: ReadonlyMap<string, EnumOption[]> = new Map(),
): ResourceSchema {
  const fields = [...definition.fields.values()]
    .filter((field) => !field.requires || permissions.has(field.requires))
    .map((field) => ({
      name: field.name,
      label: field.label,
      type: field.type,
      operators: [...field.operators],
      sortable: field.sortable,
      defaultVisible: field.defaultVisible,
      options: dynamicOptions.get(field.name) ?? field.options,
      keyed: field.type === 'json',
      display: field.display,
      width: field.width,
    }));
  const visible = new Set(fields.map((field) => field.name));
  return {
    resource: definition.name,
    label: definition.label,
    fields,
    logic: [...definition.logic],
    searchable: definition.search.length > 0,
    defaultSort: definition.defaultSort.filter((sort) => visible.has(sort.field)),
    defaultPageSize: definition.defaultPageSize,
    maxPageSize: definition.maxPageSize,
    limits: {
      maxDepth: FILTER_LIMITS.maxDepth,
      maxConditions: FILTER_LIMITS.maxConditions,
      maxListValues: FILTER_LIMITS.maxListValues,
      maxSortFields: FILTER_LIMITS.maxSortFields,
    },
  };
}
