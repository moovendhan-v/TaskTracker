import type { FieldType, FilterOperator, LogicOperator, SortSpec } from './filter.js';

export interface EnumOption {
  value: string;
  label: string;
  color?: string | null;
}

/** One column of a resource, as the API describes it to clients. */
export interface ResourceFieldSchema {
  name: string;
  label: string;
  type: FieldType;
  /** Operators this field accepts. Empty means it can't be filtered. */
  operators: FilterOperator[];
  sortable: boolean;
  /** Shown in tables unless the user hides it. */
  defaultVisible: boolean;
  /** For enum fields. */
  options?: EnumOption[] | null;
  /** For json fields: filter on a key with `field.key`. */
  keyed: boolean;
  /** A hint for how clients display the value: 'badge', 'avatar', 'date', 'relative', 'color', 'code'. */
  display?: string | null;
  /** Suggested column width in pixels. */
  width?: number | null;
}

/** Everything a client needs to render a table, a filter builder and paging for a resource. */
export interface ResourceSchema {
  resource: string;
  label: string;
  fields: ResourceFieldSchema[];
  /** Group operators the API accepts in filters for this resource. */
  logic: LogicOperator[];
  searchable: boolean;
  defaultSort: SortSpec[];
  defaultPageSize: number;
  maxPageSize: number;
  limits: {
    maxDepth: number;
    maxConditions: number;
    maxListValues: number;
    maxSortFields: number;
  };
}
