import type { FilterNode, TaskResponse } from '@taskflow/shared-types';
import { UserAvatar } from '@/components/common/user-avatar';
import { StatusPill } from '@/components/kit/status-pill';
import { cn } from '@/lib/cn';
import { dayOf, formatDueDay, today } from '@/lib/days';
import { queryKeys } from '@/lib/query-keys';
import { useMemberName } from '@/modules/members';
import { ResourceTable } from '@/modules/resources';
import { isClosed, PRIORITY_META, PriorityIcon, tasksApi, TypeBadge } from '@/modules/tasks';

interface TaskTableViewProps {
  workspaceId: string;
  spaceId: string;
  listId?: string;
  baseFilter: FilterNode | null;
  search: string;
  onOpen: (taskId: string) => void;
}

/** The project's tasks as a table built from the API's `tasks` resource schema. */
export function TaskTableView({ workspaceId, spaceId, listId, baseFilter, search, onOpen }: TaskTableViewProps) {
  const memberName = useMemberName(workspaceId);
  return (
    <ResourceTable<TaskResponse>
      workspaceId={workspaceId}
      resource="tasks"
      tableKey={`tasks:space:${spaceId}`}
      label="Tasks"
      queryKey={[...queryKeys.tasksRoot(workspaceId), 'table', spaceId, listId ?? null]}
      fetchPage={(query) => tasksApi.search(workspaceId, { spaceId, listId: listId ?? null }, query)}
      getRowId={(task) => task.id}
      baseFilter={baseFilter}
      search={search}
      onRowClick={(task) => onOpen(task.id)}
      cells={{
        number: (task) => <span className="text-muted-foreground tabular-nums">#{task.number}</span>,
        title: (task) => <span className="font-medium">{task.title}</span>,
        statusId: (task) => <StatusPill status={task.status} />,
        priority: (task) =>
          task.priority === 'none' ? (
            <span className="text-muted-foreground">–</span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <PriorityIcon priority={task.priority} /> {PRIORITY_META[task.priority].label}
            </span>
          ),
        startDate: (task) => {
          const start = dayOf(task.startDate);
          return start ? <span className="tabular-nums">{formatDueDay(start)}</span> : <span className="text-muted-foreground">–</span>;
        },
        dueDate: (task) => {
          const due = dayOf(task.dueDate);
          if (!due) return <span className="text-muted-foreground">–</span>;
          const overdue = due < today() && !isClosed(task);
          return (
            <span className={cn('tabular-nums', overdue && 'font-medium text-destructive')} title={overdue ? 'Overdue' : undefined}>
              {formatDueDay(due)}
              {overdue ? <span className="sr-only"> (overdue)</span> : null}
            </span>
          );
        },
        type: (task) => <TypeBadge type={task.type} />,
        assigneeId: (task) => {
          const ids = task.assigneeIds?.length ? task.assigneeIds : task.assigneeId ? [task.assigneeId] : [];
          if (ids.length > 1) {
            return (
              <span className="inline-flex items-center gap-1.5">
                <div className="flex -space-x-1.5 items-center">
                  {ids.slice(0, 3).map((id) => (
                    <UserAvatar key={id} name={memberName(id) ?? 'Member'} className="size-5 ring-2 ring-background shrink-0 text-[9px]" showTooltip />
                  ))}
                  {ids.length > 3 && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold ring-2 ring-background shrink-0">
                      +{ids.length - 3}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{ids.length} assignees</span>
              </span>
            );
          }
          const name = memberName(ids[0] ?? null);
          return name ? (
            <span className="inline-flex items-center gap-1.5">
              <UserAvatar name={name} className="size-5" /> <span className="truncate">{name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          );
        },
      }}
    />
  );
}
