import {
  FILTER_LIMITS,
  OPERATORS_BY_TYPE,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  type EnumOption,
  type FieldType,
  type FilterOperator,
  type LogicOperator,
  type Permission,
  type SortSpec,
} from '@taskflow/shared-types';

/** How one field of a resource is filtered, sorted and shown. */
export interface QueryFieldOptions {
  type: FieldType;
  /**
   * SQL expression for the field, e.g. `task.title`. Written by developers, never
   * built from input; values always go in as bound parameters.
   */
  column: string;
  /** SQL to sort by when it differs from `column`, e.g. a rank for priorities. */
  sortColumn?: string;
  label?: string;
  /** Narrower than the type's operators. Defaults to all of them. */
  operators?: readonly FilterOperator[];
  /** Set false for fields that are shown but can't be filtered. */
  filterable?: boolean;
  sortable?: boolean;
  defaultVisible?: boolean;
  /** Allowed values of an enum field. */
  options?: readonly (EnumOption | string)[];
  display?: string;
  width?: number;
  /** Only callers with this permission see, filter or sort by the field. */
  requires?: Permission;
  /** A protected field key (e.g. `member.email`): only callers allowed to read it can see, filter or sort by it. */
  field?: string;
}

export interface QueryResourceOptions {
  /** Name clients use to ask for the schema, e.g. `tasks`. */
  name: string;
  label: string;
  /** Needed to see the resource at all. Leave out when every member may list it. */
  permission?: Permission;
  /** SQL for the primary key; the final tie-breaker so pages never overlap. */
  idColumn: string;
  defaultSort: SortSpec[];
  defaultPageSize?: number;
  maxPageSize?: number;
  logic?: readonly LogicOperator[];
  /** Columns matched by the free-text search box; protected ones only for callers who can read them. */
  search?: readonly (string | SearchColumn)[];
}

export interface SearchColumn {
  column: string;
  /** Protected field key the column holds. */
  field: string;
}

export interface QueryFieldDefinition extends Required<Pick<QueryFieldOptions, 'type' | 'column'>> {
  name: string;
  label: string;
  sortColumn: string;
  operators: readonly FilterOperator[];
  sortable: boolean;
  defaultVisible: boolean;
  options: EnumOption[] | null;
  display: string | null;
  width: number | null;
  requires: Permission | null;
  protectedField: string | null;
}

export interface QueryResourceDefinition {
  name: string;
  label: string;
  permission: Permission | null;
  idColumn: string;
  defaultSort: SortSpec[];
  defaultPageSize: number;
  maxPageSize: number;
  logic: readonly LogicOperator[];
  search: readonly { column: string; field: string | null }[];
  fields: ReadonlyMap<string, QueryFieldDefinition>;
}

const pendingFields = new WeakMap<object, QueryFieldDefinition[]>();
const resources = new Map<string, QueryResourceDefinition>();
const byClass = new WeakMap<object, QueryResourceDefinition>();

/**
 * Declares one filterable, sortable column of a query resource:
 *
 *   @QueryField({ type: 'string', column: 'task.title', sortable: true })
 *   title!: string;
 */
export function QueryField(options: QueryFieldOptions): PropertyDecorator {
  return (target, propertyKey) => {
    const name = String(propertyKey);
    const allowed = OPERATORS_BY_TYPE[options.type];
    const operators = options.filterable === false ? [] : (options.operators ?? allowed);
    const invalid = operators.filter((op) => !allowed.includes(op));
    if (invalid.length > 0) throw new Error(`@QueryField ${name}: ${invalid.join(', ')} not valid for ${options.type}`);
    if (options.type === 'enum' && !options.options?.length) throw new Error(`@QueryField ${name}: enum fields need options`);

    const fields = pendingFields.get(target.constructor) ?? [];
    fields.push({
      name,
      type: options.type,
      column: options.column,
      sortColumn: options.sortColumn ?? options.column,
      label: options.label ?? humanize(name),
      operators,
      sortable: options.sortable ?? false,
      defaultVisible: options.defaultVisible ?? true,
      options: options.options?.map((option) => (typeof option === 'string' ? { value: option, label: humanize(option) } : option)) ?? null,
      display: options.display ?? null,
      width: options.width ?? null,
      requires: options.requires ?? null,
      protectedField: options.field ?? null,
    });
    pendingFields.set(target.constructor, fields);
  };
}

/**
 * Turns a class of @QueryField properties into a query resource: the API then
 * validates filters, sorting and paging against it, compiles them to SQL with
 * bound parameters, and publishes it through `resourceSchema` so clients can
 * build tables and filter UIs from it.
 */
export function QueryResource(options: QueryResourceOptions): ClassDecorator {
  return (target) => {
    if (resources.has(options.name)) throw new Error(`Query resource "${options.name}" is declared twice`);
    const fields = new Map((pendingFields.get(target) ?? []).map((field) => [field.name, field]));
    for (const sort of options.defaultSort) {
      if (!fields.get(sort.field)?.sortable) throw new Error(`Query resource "${options.name}": default sort field ${sort.field} must be sortable`);
    }
    const definition: QueryResourceDefinition = {
      name: options.name,
      label: options.label,
      permission: options.permission ?? null,
      idColumn: options.idColumn,
      defaultSort: options.defaultSort,
      defaultPageSize: options.defaultPageSize ?? PAGE_SIZE_DEFAULT,
      maxPageSize: Math.min(options.maxPageSize ?? PAGE_SIZE_MAX, PAGE_SIZE_MAX),
      logic: options.logic ?? ['and', 'or', 'not'],
      search: (options.search ?? []).map((entry) => (typeof entry === 'string' ? { column: entry, field: null } : entry)),
      fields,
    };
    resources.set(options.name, definition);
    byClass.set(target, definition);
  };
}

/** The definition behind a @QueryResource class or name. */
export function queryResource(nameOrClass: string | object): QueryResourceDefinition {
  const definition = typeof nameOrClass === 'string' ? resources.get(nameOrClass) : byClass.get(nameOrClass);
  if (!definition) throw new Error(`Unknown query resource ${typeof nameOrClass === 'string' ? nameOrClass : 'class'}`);
  return definition;
}

export function findQueryResource(name: string): QueryResourceDefinition | undefined {
  return resources.get(name);
}

export function allQueryResources(): QueryResourceDefinition[] {
  return [...resources.values()];
}

/** Limits that apply to every resource, published with each schema. */
export const QUERY_LIMITS = FILTER_LIMITS;

function humanize(name: string): string {
  const spaced = name
    .replace(/Id$/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
