import { ChevronRightIcon } from 'lucide-react';
import type { TaskResponse, TaskStatus } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';
import { usePermissions } from '@/modules/workspaces';
import { STATUS_META } from '../../lib/task-meta';
import { useTaskViewStore } from '../../store/task-view.store';
import { QuickAddTask } from '../shared/quick-add-task';
import { StatusDot } from '../shared/status-picker';
import { TaskRow } from './task-row';

interface TaskGroupProps {
  workspaceId: string;
  listId: string;
  status: TaskStatus;
  tasks: TaskResponse[];
  onOpen: (taskId: string) => void;
}

export function TaskGroup({ workspaceId, listId, status, tasks, onOpen }: TaskGroupProps) {
  const groupKey = `${listId}:${status}`;
  const collapsed = useTaskViewStore((state) => Boolean(state.collapsedGroups[groupKey]));
  const toggleGroup = useTaskViewStore((state) => state.toggleGroup);
  const { can } = usePermissions(workspaceId);

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => toggleGroup(groupKey)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-2 border-b bg-muted/40 px-3 py-2 text-left"
      >
        <ChevronRightIcon className={cn('size-4 text-muted-foreground transition-transform', !collapsed && 'rotate-90')} />
        <StatusDot status={status} />
        <span className="text-sm font-semibold">{STATUS_META[status].label}</span>
        <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">{tasks.length}</span>
      </button>
      {collapsed ? null : (
        <div>
          {tasks.map((task) => (
            <TaskRow key={task.id} workspaceId={workspaceId} task={task} onOpen={onOpen} />
          ))}
          {can('task.create') ? <QuickAddTask workspaceId={workspaceId} listId={listId} status={status} /> : null}
        </div>
      )}
    </section>
  );
}
