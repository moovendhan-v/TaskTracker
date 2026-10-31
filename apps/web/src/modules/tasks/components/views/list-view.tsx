import { GitBranchIcon, PlusIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isClosedCategory, type Permission, type TaskResponse, type TaskStatusResponse } from '@taskflow/shared-types';
import { Section } from '@/components/kit/section';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/cn';
import { usePermissions } from '@/modules/workspaces';
import { useMemberName } from '@/modules/members';
import { useTaskMutations } from '../../hooks/use-task-mutations';
import { groupTasks, type GroupBy, type TaskGroup } from '../../lib/group-tasks';
import { exportTasks } from '../../lib/export-tasks';
import { AssigneePicker } from '../shared/assignee-picker';
import { PriorityPicker } from '../shared/priority-picker';
import { QuickAddTask } from '../shared/quick-add-task';
import { StatusPicker } from '../shared/status-picker';
import { TaskDates } from '../shared/task-dates';
import { BulkBar } from './bulk-bar';

interface ListViewProps {
  workspaceId: string;
  tasks: readonly TaskResponse[];
  statuses: readonly TaskStatusResponse[];
  groupBy: GroupBy;
  /** Where quick-added tasks go; without a list or space there's no quick add (e.g. a whole-workspace view). */
  defaultListId?: string;
  /** Quick add goes into this space's first list when there's no default list. */
  spaceId?: string;
  /** Used to remember collapsed groups per project. */
  scopeKey: string;
  onOpen: (taskId: string) => void;
  /** Hides groups that have no tasks (e.g. on "My tasks"). */
  hideEmpty?: boolean;
}

const GRID = 'grid grid-cols-[1.75rem_3.25rem_minmax(12rem,1fr)_9rem_7rem_7.5rem_9rem] items-center gap-2';

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/** Tasks in groups with column headers, inline editing, quick add and multi-select. */
export function ListView({ workspaceId, tasks, statuses, groupBy, defaultListId, spaceId, scopeKey, onOpen, hideEmpty = false }: ListViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const memberName = useMemberName(workspaceId);
  const { updateMany } = useTaskMutations(workspaceId);
  const groups = groupTasks(tasks, groupBy, statuses, memberName).filter((group) => !hideEmpty || group.tasks.length > 0);
  const selectedIds = [...selected].filter((id) => tasks.some((task) => task.id === id));
  const bulk = (body: Parameters<typeof updateMany.mutate>[0]['body']) => updateMany.mutate({ taskIds: selectedIds, body }, { onSuccess: () => setSelected(new Set()) });
  const container = useRef<HTMLDivElement>(null);

  // J / K move between rows, X selects the focused row, Enter opens it (v2 tracker keys).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isEditable(event.target) || document.querySelector('[role="dialog"],[role="menu"]')) return;
      const rows = [...(container.current?.querySelectorAll<HTMLElement>('[data-task-row]') ?? [])];
      if (rows.length === 0) return;
      const current = rows.findIndex((row) => row.contains(document.activeElement));
      const key = event.key.toLowerCase();
      if (key === 'j' || key === 'k') {
        event.preventDefault();
        const next = current === -1 ? 0 : Math.min(rows.length - 1, Math.max(0, current + (key === 'j' ? 1 : -1)));
        rows[next]!.focus();
        rows[next]!.scrollIntoView({ block: 'nearest' });
      } else if (key === 'x' && current !== -1) {
        event.preventDefault();
        const id = rows[current]!.dataset['taskRow']!;
        setSelected((previous) => {
          const next = new Set(previous);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      } else if (event.key === 'Escape' && selected.size > 0) {
        setSelected(new Set());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected.size]);

  return (
    <div ref={container} className="grid gap-5 pb-24">
      {groups.map((group) => (
        <GroupBlock key={group.key} workspaceId={workspaceId} group={group} defaultListId={defaultListId} spaceId={spaceId} scopeKey={scopeKey} selected={selected} onSelect={setSelected} onOpen={onOpen} />
      ))}
      {selectedIds.length > 0 ? (
        <BulkBar
          workspaceId={workspaceId}
          count={selectedIds.length}
          statuses={statuses}
          onStatus={(status) => bulk({ statusId: status.id })}
          onPriority={(priority) => bulk({ priority })}
          onAssignee={(assigneeId) => bulk({ assigneeId })}
          onExport={() => exportTasks(tasks.filter((task) => selected.has(task.id)), memberName)}
          onClear={() => setSelected(new Set())}
        />
      ) : null}
    </div>
  );
}

interface GroupBlockProps {
  workspaceId: string;
  group: TaskGroup;
  defaultListId?: string;
  spaceId?: string;
  scopeKey: string;
  selected: Set<string>;
  onSelect: (selected: Set<string>) => void;
  onOpen: (taskId: string) => void;
}

function GroupBlock({ workspaceId, group, defaultListId, spaceId, scopeKey, selected, onSelect, onOpen }: GroupBlockProps) {
  const [adding, setAdding] = useState(false);
  const { can, canIn } = usePermissions(workspaceId);
  const ids = group.tasks.map((task) => task.id);
  const all = ids.length > 0 && ids.every((id) => selected.has(id));
  const canAdd = Boolean(defaultListId || spaceId) && (spaceId ? canIn(spaceId, 'task.create') : can('task.create'));
  const toggleAll = (checked: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    onSelect(next);
  };

  return (
    <Section
      storageKey={`${scopeKey}:${group.key}`}
      title={
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          {group.status ? <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: group.status.color }} /> : null}
          {group.label}
        </span>
      }
      count={group.tasks.length}
      actions={
        <>
          {ids.length > 0 ? <Checkbox aria-label={`Select all in ${group.label}`} checked={all} onCheckedChange={(checked) => toggleAll(checked === true)} /> : null}
          {canAdd ? (
            <button type="button" className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Add task to ${group.label}`} onClick={() => setAdding(true)}>
              <PlusIcon className="size-4" />
            </button>
          ) : null}
        </>
      }
    >
      <div role="table" aria-label={group.label} className="text-sm">
        <div role="row" className={cn(GRID, 'h-8 border-b px-2 font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase')}>
          <span role="columnheader" aria-label="Select" />
          <span role="columnheader">ID</span>
          <span role="columnheader">Title</span>
          <span role="columnheader">Status</span>
          <span role="columnheader">Assignees</span>
          <span role="columnheader">Priority</span>
          <span role="columnheader">Dates</span>
        </div>
        {group.tasks.map((task) => (
          <TaskRow
            key={task.id}
            workspaceId={workspaceId}
            task={task}
            selected={selected.has(task.id)}
            onSelect={(checked) => {
              const next = new Set(selected);
              if (checked) next.add(task.id);
              else next.delete(task.id);
              onSelect(next);
            }}
            onOpen={onOpen}
          />
        ))}
        {canAdd ? (
          <QuickAddTask
            key={adding ? 'open' : 'closed'}
            workspaceId={workspaceId}
            listId={defaultListId}
            spaceId={spaceId}
            statusId={group.status?.id}
            defaults={{ ...(group.priority && { priority: group.priority }), ...(group.assigneeId !== undefined && { assigneeId: group.assigneeId }) }}
            startOpen={adding}
            onClose={() => setAdding(false)}
            className="pl-9"
          />
        ) : null}
      </div>
    </Section>
  );
}

interface TaskRowProps {
  workspaceId: string;
  task: TaskResponse;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onOpen: (taskId: string) => void;
}

function TaskRow({ workspaceId, task, selected, onSelect, onOpen }: TaskRowProps) {
  const { update } = useTaskMutations(workspaceId);
  const { canIn } = usePermissions(workspaceId);
  const can = (permission: Permission) => canIn(task.spaceId, permission);
  const canEdit = can('task.update');
  const closed = isClosedCategory(task.status.category);
  const setStatus = (status: TaskStatusResponse) => update.mutate({ taskId: task.id, body: { statusId: status.id }, status });

  return (
    <div
      role="row"
      aria-selected={selected}
      tabIndex={-1}
      data-task-row={task.id}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || event.target !== event.currentTarget) return;
        // Without this, the same Enter would also press whatever the opened task focuses (its close button).
        event.preventDefault();
        onOpen(task.id);
      }}
      className={cn(
        GRID,
        'group border-b border-border/70 px-2 transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:shadow-[inset_2px_0_0_var(--ring)] focus-visible:outline-none',
        selected && 'bg-primary-soft hover:bg-primary-soft',
      )}
      style={{ minHeight: 'calc(var(--row-height) + 2px)' }}
    >
      <span role="cell" className={cn('transition-opacity', !selected && 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 focus-within:opacity-100')}>
        <Checkbox aria-label={`Select ${task.title}`} checked={selected} onCheckedChange={(checked) => onSelect(checked === true)} />
      </span>
      <span role="cell" className="font-mono text-[11.5px] font-medium text-subtle-foreground tabular-nums">
        #{task.number}
      </span>
      <span role="cell" className="flex min-w-0 items-center gap-1.5">
        <button type="button" onClick={() => onOpen(task.id)} className={cn('truncate text-left text-[13px] hover:text-primary', closed && 'text-muted-foreground line-through')}>
          {task.title}
        </button>
        {task.subtaskCount > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[11px] text-subtle-foreground" aria-label={`${task.subtaskCount} subtasks`}>
            <GitBranchIcon className="size-3" />
            {task.subtaskCount}
          </span>
        ) : null}
      </span>
      <span role="cell" className="min-w-0">
        <StatusPicker variant="pill" workspaceId={workspaceId} value={task.status} disabled={!canEdit} onChange={setStatus} />
      </span>
      <span role="cell">
        <AssigneePicker
          workspaceId={workspaceId}
          values={task.assigneeIds?.length ? task.assigneeIds : (task.assigneeId ? [task.assigneeId] : [])}
          disabled={!can('task.assign')}
          onChangeMultiple={(assigneeIds) => update.mutate({ taskId: task.id, body: { assigneeIds } })}
        />
      </span>
      <span role="cell">
        <PriorityPicker showLabel value={task.priority} disabled={!canEdit} onChange={(priority) => update.mutate({ taskId: task.id, body: { priority } })} />
      </span>
      <span role="cell" className="text-xs">
        <TaskDates startDate={task.startDate} dueDate={task.dueDate} closed={closed} />
      </span>
    </div>
  );
}
