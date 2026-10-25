import { GitBranchIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { isClosedCategory, type TaskResponse, type TaskStatusResponse } from '@taskflow/shared-types';
import { Section } from '@/components/kit/section';
import { StatusPill } from '@/components/kit/status-pill';
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
  /** Where quick-added tasks go; without one there's no quick add (e.g. a whole-workspace view). */
  defaultListId?: string;
  /** Used to remember collapsed groups per project. */
  scopeKey: string;
  onOpen: (taskId: string) => void;
  /** Hides groups that have no tasks (e.g. on "My tasks"). */
  hideEmpty?: boolean;
}

const GRID = 'grid grid-cols-[2rem_minmax(14rem,1fr)_7rem_11rem_8rem_9rem] items-center gap-2';

/** Tasks in groups with column headers, inline editing, quick add and multi-select. */
export function ListView({ workspaceId, tasks, statuses, groupBy, defaultListId, scopeKey, onOpen, hideEmpty = false }: ListViewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const memberName = useMemberName(workspaceId);
  const { updateMany } = useTaskMutations(workspaceId);
  const groups = groupTasks(tasks, groupBy, statuses, memberName).filter((group) => !hideEmpty || group.tasks.length > 0);
  const selectedIds = [...selected].filter((id) => tasks.some((task) => task.id === id));
  const bulk = (body: Parameters<typeof updateMany.mutate>[0]['body']) => updateMany.mutate({ taskIds: selectedIds, body }, { onSuccess: () => setSelected(new Set()) });

  return (
    <div className="grid gap-5 pb-24">
      {groups.map((group) => (
        <GroupBlock key={group.key} workspaceId={workspaceId} group={group} defaultListId={defaultListId} scopeKey={scopeKey} selected={selected} onSelect={setSelected} onOpen={onOpen} />
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
  scopeKey: string;
  selected: Set<string>;
  onSelect: (selected: Set<string>) => void;
  onOpen: (taskId: string) => void;
}

function GroupBlock({ workspaceId, group, defaultListId, scopeKey, selected, onSelect, onOpen }: GroupBlockProps) {
  const [adding, setAdding] = useState(false);
  const { can } = usePermissions(workspaceId);
  const ids = group.tasks.map((task) => task.id);
  const all = ids.length > 0 && ids.every((id) => selected.has(id));
  const canAdd = Boolean(defaultListId) && can('task.create');
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
      title={group.status ? <StatusPill status={group.status} /> : <span className="text-sm font-semibold">{group.label}</span>}
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
        <div role="row" className={cn(GRID, 'border-b px-2 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase')}>
          <span role="columnheader" aria-label="Select" />
          <span role="columnheader" className="pl-6">
            Name
          </span>
          <span role="columnheader">Assignee</span>
          <span role="columnheader">Dates</span>
          <span role="columnheader">Priority</span>
          <span role="columnheader">Status</span>
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
        {canAdd && defaultListId ? (
          <QuickAddTask
            key={adding ? 'open' : 'closed'}
            workspaceId={workspaceId}
            listId={defaultListId}
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
  const { can } = usePermissions(workspaceId);
  const canEdit = can('task.update');
  const closed = isClosedCategory(task.status.category);
  const setStatus = (status: TaskStatusResponse) => update.mutate({ taskId: task.id, body: { statusId: status.id }, status });

  return (
    <div role="row" aria-selected={selected} className={cn(GRID, 'group rounded-md px-2 hover:bg-muted/50', selected && 'bg-primary/10')} style={{ minHeight: 'var(--row-height)' }}>
      <span role="cell" className={cn('transition-opacity', !selected && 'opacity-0 group-hover:opacity-100 focus-within:opacity-100')}>
        <Checkbox aria-label={`Select ${task.title}`} checked={selected} onCheckedChange={(checked) => onSelect(checked === true)} />
      </span>
      <span role="cell" className="flex min-w-0 items-center gap-1.5">
        <StatusPicker compact workspaceId={workspaceId} value={task.status} disabled={!canEdit} onChange={setStatus} />
        <button type="button" onClick={() => onOpen(task.id)} className={cn('truncate text-left font-medium hover:text-primary', closed && 'text-muted-foreground line-through')}>
          {task.title}
        </button>
        {task.subtaskCount > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground" aria-label={`${task.subtaskCount} subtasks`}>
            <GitBranchIcon className="size-3" />
            {task.subtaskCount}
          </span>
        ) : null}
      </span>
      <span role="cell">
        <AssigneePicker workspaceId={workspaceId} value={task.assigneeId} disabled={!can('task.assign')} onChange={(assigneeId) => update.mutate({ taskId: task.id, body: { assigneeId } })} />
      </span>
      <span role="cell">
        <TaskDates startDate={task.startDate} dueDate={task.dueDate} closed={closed} />
      </span>
      <span role="cell">
        <PriorityPicker showLabel value={task.priority} disabled={!canEdit} onChange={(priority) => update.mutate({ taskId: task.id, body: { priority } })} />
      </span>
      <span role="cell">
        <StatusPicker variant="pill" workspaceId={workspaceId} value={task.status} disabled={!canEdit} onChange={setStatus} />
      </span>
    </div>
  );
}
