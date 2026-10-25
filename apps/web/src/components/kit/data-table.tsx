import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, Columns3Icon, RotateCcwIcon } from 'lucide-react';
import { useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

export interface DataColumn<T> {
  id: string;
  header: ReactNode;
  /** Plain name for menus and screen readers when `header` isn't text. */
  title?: string;
  cell: (row: T) => ReactNode;
  width?: number;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  /** Field to sort by when the header is clicked; leave out for unsortable columns. */
  sortField?: string;
  /** False keeps the column out of the column chooser (always shown). */
  hideable?: boolean;
}

export interface SortSpec {
  field: string;
  direction: 'asc' | 'desc';
}

/** How the user arranged the table; save it (e.g. in preferences) to keep it across sessions. */
export interface TableLayoutState {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  pageSizes?: readonly number[];
  onChange: (page: number, pageSize: number) => void;
}

interface DataTableProps<T> {
  columns: readonly DataColumn<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string;
  label: string;
  layout?: TableLayoutState;
  onLayoutChange?: (layout: TableLayoutState) => void;
  onLayoutReset?: () => void;
  sort?: readonly SortSpec[];
  onSortChange?: (sort: SortSpec[]) => void;
  selection?: { selected: ReadonlySet<string>; onChange: (selected: Set<string>) => void };
  pagination?: Pagination;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Controls left of the column chooser, e.g. filters. */
  toolbar?: ReactNode;
  className?: string;
}

const DEFAULT_WIDTH = 160;

/** Puts columns in the saved order; columns the layout doesn't know yet go at the end. */
function orderedColumns<T>(columns: readonly DataColumn<T>[], layout: TableLayoutState | undefined): DataColumn<T>[] {
  if (!layout?.order.length) return [...columns];
  const rank = new Map(layout.order.map((id, index) => [id, index]));
  return [...columns].sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

/**
 * The one table used everywhere: sortable headers (shift-click adds a sort),
 * row selection, paging, and columns the user can show, hide, drag into a new
 * order and resize. It owns no data: rows, sort, paging and layout come in
 * through props, so it works with server-side queries and saved preferences.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  label,
  layout,
  onLayoutChange,
  onLayoutReset,
  sort = [],
  onSortChange,
  selection,
  pagination,
  loading = false,
  empty = 'Nothing to show',
  onRowClick,
  toolbar,
  className,
}: DataTableProps<T>) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const resizing = useRef<{ id: string; startX: number; startWidth: number } | null>(null);
  const [liveWidths, setLiveWidths] = useState<Record<string, number>>({});

  const current: TableLayoutState = layout ?? { order: columns.map((column) => column.id), hidden: [], widths: {} };
  const hidden = new Set(current.hidden);
  const visible = orderedColumns(columns, layout).filter((column) => !hidden.has(column.id));
  const widthOf = (column: DataColumn<T>) => liveWidths[column.id] ?? current.widths[column.id] ?? column.width ?? DEFAULT_WIDTH;
  const change = (next: Partial<TableLayoutState>) => onLayoutChange?.({ ...current, order: orderedColumns(columns, layout).map((column) => column.id), ...next });

  const sortOf = (field: string) => sort.find((item) => item.field === field);
  const toggleSort = (field: string, additive: boolean) => {
    if (!onSortChange) return;
    const existing = sortOf(field);
    const next: SortSpec | null = !existing ? { field, direction: 'asc' } : existing.direction === 'asc' ? { field, direction: 'desc' } : null;
    const others = additive ? sort.filter((item) => item.field !== field) : [];
    onSortChange(next ? [...others, next] : others);
  };

  const ids = rows.map(getRowId);
  const allSelected = selection && ids.length > 0 && ids.every((id) => selection.selected.has(id));
  const someSelected = selection && ids.some((id) => selection.selected.has(id));

  const startResize = (event: ReactPointerEvent, column: DataColumn<T>) => {
    event.preventDefault();
    event.stopPropagation();
    resizing.current = { id: column.id, startX: event.clientX, startWidth: widthOf(column) };
    const onMove = (move: PointerEvent) => {
      const state = resizing.current;
      if (!state) return;
      setLiveWidths((widths) => ({ ...widths, [state.id]: Math.max(column.minWidth ?? 60, Math.round(state.startWidth + move.clientX - state.startX)) }));
    };
    const onUp = (up: PointerEvent) => {
      const state = resizing.current;
      resizing.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!state) return;
      const width = Math.max(column.minWidth ?? 60, Math.round(state.startWidth + up.clientX - state.startX));
      setLiveWidths((widths) => {
        const { [state.id]: _done, ...rest } = widths;
        return rest;
      });
      change({ widths: { ...current.widths, [state.id]: width } });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const dropOn = (event: DragEvent, targetId: string) => {
    event.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    const order = orderedColumns(columns, layout).map((column) => column.id).filter((id) => id !== draggedId);
    order.splice(order.indexOf(targetId), 0, draggedId);
    setDraggedId(null);
    change({ order });
  };

  const pageCount = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      {toolbar || onLayoutChange ? (
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbar}</div>
          {onLayoutChange ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3Icon /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                {orderedColumns(columns, layout)
                  .filter((column) => column.hideable !== false)
                  .map((column) => (
                    <DropdownMenuItem
                      key={column.id}
                      onSelect={(event) => {
                        event.preventDefault();
                        change({ hidden: hidden.has(column.id) ? current.hidden.filter((id) => id !== column.id) : [...current.hidden, column.id] });
                      }}
                    >
                      <CheckIcon className={cn(hidden.has(column.id) && 'opacity-0')} />
                      {column.title ?? column.header}
                    </DropdownMenuItem>
                  ))}
                {onLayoutReset ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={onLayoutReset}>
                      <RotateCcwIcon /> Reset layout
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-card">
        <table aria-label={label} className="w-full table-fixed border-collapse text-sm" style={{ minWidth: visible.reduce((sum, column) => sum + widthOf(column), selection ? 44 : 0) }}>
          <colgroup>
            {selection ? <col style={{ width: 44 }} /> : null}
            {visible.map((column) => (
              <col key={column.id} style={{ width: widthOf(column) }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-[1] bg-card">
            <tr className="border-b text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {selection ? (
                <th className="px-3 py-2">
                  <Checkbox
                    aria-label="Select all rows"
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(checked) => {
                      const next = new Set(selection.selected);
                      for (const id of ids) {
                        if (checked) next.add(id);
                        else next.delete(id);
                      }
                      selection.onChange(next);
                    }}
                  />
                </th>
              ) : null}
              {visible.map((column) => {
                const sorted = column.sortField ? sortOf(column.sortField) : undefined;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={sorted ? (sorted.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                    draggable={Boolean(onLayoutChange)}
                    onDragStart={() => setDraggedId(column.id)}
                    onDragOver={(event) => draggedId && event.preventDefault()}
                    onDrop={(event) => dropOn(event, column.id)}
                    className={cn('group relative px-3 py-2 font-medium select-none', column.align === 'right' && 'text-right', column.align === 'center' && 'text-center', draggedId === column.id && 'opacity-50')}
                  >
                    {column.sortField && onSortChange ? (
                      <button type="button" onClick={(event) => toggleSort(column.sortField as string, event.shiftKey)} className="inline-flex max-w-full items-center gap-1 uppercase hover:text-foreground">
                        <span className="truncate">{column.header}</span>
                        {sorted ? sorted.direction === 'asc' ? <ArrowUpIcon className="size-3 shrink-0" /> : <ArrowDownIcon className="size-3 shrink-0" /> : null}
                      </button>
                    ) : (
                      <span className="block truncate">{column.header}</span>
                    )}
                    {onLayoutChange ? (
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${column.title ?? column.id}`}
                        onPointerDown={(event) => startResize(event, column)}
                        className="absolute top-1 right-0 bottom-1 w-1.5 cursor-col-resize rounded bg-transparent group-hover:bg-border"
                      />
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }, (_, index) => (
                  <tr key={index} className="border-b last:border-b-0">
                    {selection ? <td className="px-3 py-2" /> : null}
                    {visible.map((column) => (
                      <td key={column.id} className="px-3 py-2">
                        <Skeleton className="h-4 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => {
                  const id = getRowId(row);
                  const selected = selection?.selected.has(id) ?? false;
                  return (
                    <tr
                      key={id}
                      aria-selected={selection ? selected : undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn('border-b last:border-b-0 hover:bg-muted/50', onRowClick && 'cursor-pointer', selected && 'bg-primary/10')}
                      style={{ height: 'var(--row-height)' }}
                    >
                      {selection ? (
                        <td className="px-3" onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            aria-label="Select row"
                            checked={selected}
                            onCheckedChange={(checked) => {
                              const next = new Set(selection.selected);
                              if (checked) next.add(id);
                              else next.delete(id);
                              selection.onChange(next);
                            }}
                          />
                        </td>
                      ) : null}
                      {visible.map((column) => (
                        <td key={column.id} className={cn('truncate px-3', column.align === 'right' && 'text-right tabular-nums', column.align === 'center' && 'text-center')}>
                          {column.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {!loading && rows.length === 0 ? <div className="px-4 py-10 text-center text-sm text-muted-foreground">{empty}</div> : null}
      </div>

      {pagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-sm text-muted-foreground">
          <span>
            {pagination.total === 0
              ? 'No results'
              : `${(pagination.page - 1) * pagination.pageSize + 1}–${Math.min(pagination.total, pagination.page * pagination.pageSize)} of ${pagination.total}`}
          </span>
          <div className="flex items-center gap-2">
            {pagination.pageSizes ? (
              <label className="flex items-center gap-1.5">
                Rows
                <select
                  value={pagination.pageSize}
                  onChange={(event) => pagination.onChange(1, Number(event.target.value))}
                  className="h-8 rounded-md border bg-card px-2 text-foreground"
                >
                  {pagination.pageSizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={pagination.page <= 1} onClick={() => pagination.onChange(pagination.page - 1, pagination.pageSize)}>
              <ChevronLeftIcon />
            </Button>
            <span className="tabular-nums">
              {pagination.page} / {pageCount}
            </span>
            <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={pagination.page >= pageCount} onClick={() => pagination.onChange(pagination.page + 1, pagination.pageSize)}>
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
