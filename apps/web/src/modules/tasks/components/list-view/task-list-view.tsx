import type { TaskResponse } from '@taskflow/shared-types';
import { STATUS_ORDER } from '../../lib/task-meta';
import { TaskGroup } from './task-group';

interface TaskListViewProps {
  workspaceId: string;
  listId: string;
  tasks: TaskResponse[];
  onOpen: (taskId: string) => void;
}

/** Tasks grouped by status, in workflow order. */
export function TaskListView({ workspaceId, listId, tasks, onOpen }: TaskListViewProps) {
  return (
    <div className="grid gap-4">
      {STATUS_ORDER.map((status) => (
        <TaskGroup
          key={status}
          workspaceId={workspaceId}
          listId={listId}
          status={status}
          tasks={tasks.filter((task) => task.status === status)}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
