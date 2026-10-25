import type { DragEvent } from 'react';
import type { TaskResponse, TaskStatusResponse } from '@taskflow/shared-types';
import { usePermissions } from '@/modules/workspaces';
import { useStatuses } from '../../hooks/use-tasks';
import { useTaskMutations } from '../../hooks/use-task-mutations';
import { positionBetween } from '../../lib/task-meta';
import { BoardColumn } from './board-column';
import { TASK_DRAG_TYPE } from './task-card';

interface TaskBoardViewProps {
  workspaceId: string;
  /** Space whose statuses make the columns. */
  spaceId: string;
  /** Set when the board shows one list; enables quick-add. Sprint boards span lists and leave it out. */
  listId?: string;
  tasks: TaskResponse[];
  onOpen: (taskId: string) => void;
}

/** One column per status; drag a card to change its status or order. */
export function TaskBoardView({ workspaceId, spaceId, listId, tasks, onOpen }: TaskBoardViewProps) {
  const { update } = useTaskMutations(workspaceId);
  const { can } = usePermissions(workspaceId);
  const { data: statuses = [] } = useStatuses(workspaceId, spaceId);
  const byStatus = (statusId: string) =>
    tasks.filter((task) => task.statusId === statusId).sort((a, b) => a.position - b.position);

  function handleDrop(event: DragEvent, status: TaskStatusResponse, beforeTaskId: string | null) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData(TASK_DRAG_TYPE);
    if (!taskId || taskId === beforeTaskId) return;

    const column = byStatus(status.id).filter((task) => task.id !== taskId);
    const index = beforeTaskId ? column.findIndex((task) => task.id === beforeTaskId) : column.length;
    const position = positionBetween(column[index - 1]?.position, column[index]?.position);
    update.mutate({ taskId, body: { statusId: status.id, position }, status });
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto pb-2">
      {statuses.map((status) => (
        <BoardColumn
          key={status.id}
          workspaceId={workspaceId}
          listId={listId}
          status={status}
          tasks={byStatus(status.id)}
          canEdit={can('task.update')}
          canCreate={Boolean(listId) && can('task.create')}
          onOpen={onOpen}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
}
