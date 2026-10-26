import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { formatMinutes, type FilterNode, type Paginated, type ResourceFieldSchema, type ResourceQuery, type SortSpec } from '@taskflow/shared-types';
import { UserAvatar } from '@/components/common/user-avatar';
import { Meter } from '@/components/kit/charts';
import { DataTable, type DataColumn, type TableLayoutState } from '@/components/kit/data-table';
import { usePreferenceMutations, usePreferences } from '@/core/preferences/use-preferences';
import { formatNumericDate } from '@/lib/periods';
import { useMemberName } from '@/modules/members';
import { toFilter, type DraftCondition } from '../lib/filters';
import { useResourceSchema } from '../hooks/use-resource-schema';
import { FilterBuilder } from './filter-builder';

const PAGE_SIZES = [25, 50, 100] as const;

interface ResourceTableProps<T> {
  workspaceId: string;
  /** Query resource name, e.g. `tasks`. */
  resource: string;
  /** Where the user's layout is saved, e.g. `tasks:space:<id>`. */
  tableKey: string;
  label: string;
  queryKey: readonly unknown[];
  fetchPage: (query: ResourceQuery) => Promise<Paginated<T>>;
  getRowId: (row: T) => string;
  /** Reads a field's value from a row; defaults to `row[field]` (and `customFields` for `custom.*`). */
  readValue?: (row: T, field: string) => unknown;
  /** Custom cells for fields that need more than the default display. */
  cells?: Partial<Record<string, (row: T) => ReactNode>>;
  /** ANDed with what the user picks, e.g. "not closed" from a toolbar toggle. */
  baseFilter?: FilterNode | null;
  search?: string;
  onRowClick?: (row: T) => void;
  toolbar?: ReactNode;
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

function defaultValue(row: unknown, field: string): unknown {
  const record = row as Record<string, unknown>;
  if (field.startsWith('custom.')) return (record['customFields'] as Record<string, unknown> | undefined)?.[field.slice(7)];
  return record[field];
}

/**
 * A table built entirely from the API's description of a resource: its
 * columns, filters, sorting and page sizes all come from `resourceSchema`.
 * The user's column order, widths, hidden columns, sort and page size are saved
 * to their preferences and follow them to every device.
 */
export function ResourceTable<T>({ workspaceId, resource, tableKey, label, queryKey, fetchPage, getRowId, readValue = defaultValue, cells = {}, baseFilter, search, onRowClick, toolbar }: ResourceTableProps<T>) {
  const { data: schema } = useResourceSchema(workspaceId, resource);
  const preferences = usePreferences();
  const { saveTable, resetTable } = usePreferenceMutations();
  const saved = preferences.tables.find((table) => table.key === tableKey);
  const memberName = useMemberName(workspaceId);
  const [conditions, setConditions] = useState<DraftCondition[]>([]);
  const [logic, setLogic] = useState<'and' | 'or'>('and');
  const [page, setPage] = useState(1);
  const [now] = useState(() => Date.now());

  const pageSize = saved?.pageSize ?? schema?.defaultPageSize ?? 50;
  const sort: SortSpec[] = saved?.sort ?? schema?.defaultSort ?? [];
  const userFilter = toFilter(conditions, logic);
  const filter = baseFilter && userFilter ? { and: [baseFilter, userFilter] } : (baseFilter ?? userFilter);
  const query: ResourceQuery = { filter, sort, search: search || null, page, pageSize };
  const rows = useQuery({ queryKey: [...queryKey, query], queryFn: () => fetchPage(query), enabled: Boolean(schema), placeholderData: keepPreviousData });

  const fields = schema?.fields ?? [];
  const layout: TableLayoutState = {
    order: saved?.columns.length ? saved.columns : fields.map((field) => field.name),
    hidden: saved ? saved.hidden : fields.filter((field) => !field.defaultVisible).map((field) => field.name),
    widths: Object.fromEntries((saved?.widths ?? []).map((width) => [width.column, width.width])),
  };
  const persist = (next: { layout?: TableLayoutState; sort?: SortSpec[]; pageSize?: number }) => {
    const nextLayout = next.layout ?? layout;
    saveTable.mutate({
      key: tableKey,
      columns: nextLayout.order,
      hidden: nextLayout.hidden,
      widths: Object.entries(nextLayout.widths).map(([column, width]) => ({ column, width })),
      pageSize: next.pageSize ?? pageSize,
      sort: next.sort ?? sort,
    });
  };

  const render = (field: ResourceFieldSchema, row: T): ReactNode => {
    const custom = cells[field.name];
    if (custom) return custom(row);
    const value = readValue(row, field.name);
    if (value === null || value === undefined || value === '') return <span className="text-muted-foreground">–</span>;
    const option = field.options?.find((item) => item.value === String(value));
    if (option)
      return (
        <span className="inline-flex items-center gap-1.5">
          {option.color ? <span className="size-2 rounded-full" style={{ background: option.color }} /> : null}
          {option.label}
        </span>
      );
    switch (field.display) {
      case 'date':
        return formatNumericDate(String(value));
      case 'relative': {
        const days = Math.round((new Date(String(value)).getTime() - now) / 86_400_000);
        return relative.format(days, 'day');
      }
      case 'progress':
        return (
          <span className="flex items-center gap-2">
            <Meter value={Number(value)} label={field.label} className="w-16" /> {String(value)}%
          </span>
        );
      case 'duration':
        return formatMinutes(Number(value));
      case 'avatar': {
        const name = memberName(String(value)) ?? 'Member';
        return (
          <span className="inline-flex items-center gap-1.5">
            <UserAvatar name={name} className="size-5" /> <span className="truncate">{name}</span>
          </span>
        );
      }
      case 'code':
        return <code className="font-mono text-xs">{JSON.stringify(value)}</code>;
      default:
        return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
    }
  };

  const columns: DataColumn<T>[] = fields.map((field) => ({
    id: field.name,
    header: field.label,
    title: field.label,
    width: field.width ?? 160,
    align: field.type === 'number' && field.display !== 'progress' ? 'right' : 'left',
    ...(field.sortable && { sortField: field.name }),
    cell: (row) => render(field, row),
  }));

  return (
    <DataTable
      label={label}
      columns={columns}
      rows={rows.data?.items ?? []}
      getRowId={getRowId}
      loading={!schema || rows.isLoading}
      layout={layout}
      onLayoutChange={(next) => persist({ layout: next })}
      onLayoutReset={() => resetTable.mutate(tableKey)}
      sort={sort}
      onSortChange={(next) => {
        setPage(1);
        persist({ sort: next.slice(0, schema?.limits.maxSortFields ?? 3) });
      }}
      pagination={{
        page,
        pageSize,
        total: rows.data?.total ?? 0,
        pageSizes: PAGE_SIZES.filter((size) => size <= (schema?.maxPageSize ?? 100)),
        onChange: (nextPage, nextSize) => {
          setPage(nextPage);
          if (nextSize !== pageSize) persist({ pageSize: nextSize });
        },
      }}
      onRowClick={onRowClick}
      toolbar={
        <>
          {schema ? (
            <FilterBuilder
              schema={schema}
              conditions={conditions}
              logic={logic}
              onChange={(next, nextLogic) => {
                setConditions(next);
                setLogic(nextLogic);
                setPage(1);
              }}
            />
          ) : null}
          {toolbar}
        </>
      }
      empty="No rows match these filters."
    />
  );
}
