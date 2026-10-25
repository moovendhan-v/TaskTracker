import type { TaskResponse } from '@taskflow/shared-types';
import { useStatuses } from '../../hooks/use-tasks';
import { TaskGroup } from './task-group';

interface TaskListViewProps {
  workspaceId: string;
  spaceId: string;
  listId: string;
  tasks: TaskResponse[];
  onOpen: (taskId: string) => void;
}

/** Tasks grouped by the space's statuses, in workflow order. */
export function TaskListView({ workspaceId, spaceId, listId, tasks, onOpen }: TaskListViewProps) {
  const { data: statuses = [] } = useStatuses(workspaceId, spaceId);
  return (
    <div className="grid gap-4">
      {statuses.map((status) => (
        <TaskGroup
          key={status.id}
          workspaceId={workspaceId}
          listId={listId}
          status={status}
          tasks={tasks.filter((task) => task.statusId === status.id)}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
