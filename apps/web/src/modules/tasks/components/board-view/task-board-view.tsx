import type { DragEvent } from 'react';
import type { TaskResponse, TaskStatus } from '@taskflow/shared-types';
import { usePermissions } from '@/modules/workspaces';
import { useTaskMutations } from '../../hooks/use-task-mutations';
import { positionBetween, STATUS_ORDER } from '../../lib/task-meta';
import { BoardColumn } from './board-column';
import { TASK_DRAG_TYPE } from './task-card';

interface TaskBoardViewProps {
  workspaceId: string;
  /** Set when the board shows one list; enables quick-add. Sprint boards span lists and leave it out. */
  listId?: string;
  tasks: TaskResponse[];
  onOpen: (taskId: string) => void;
}

/** Status columns; drag a card to change its status or order. */
export function TaskBoardView({ workspaceId, listId, tasks, onOpen }: TaskBoardViewProps) {
  const { update } = useTaskMutations(workspaceId);
  const { can } = usePermissions(workspaceId);
  const byStatus = (status: TaskStatus) =>
    tasks.filter((task) => task.status === status).sort((a, b) => a.position - b.position);

  function handleDrop(event: DragEvent, status: TaskStatus, beforeTaskId: string | null) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData(TASK_DRAG_TYPE);
    if (!taskId || taskId === beforeTaskId) return;

    const column = byStatus(status).filter((task) => task.id !== taskId);
    const index = beforeTaskId ? column.findIndex((task) => task.id === beforeTaskId) : column.length;
    const position = positionBetween(column[index - 1]?.position, column[index]?.position);
    update.mutate({ taskId, body: { status, position } });
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto pb-2">
      {STATUS_ORDER.map((status) => (
        <BoardColumn
          key={status}
          workspaceId={workspaceId}
          listId={listId}
          status={status}
          tasks={byStatus(status)}
          canEdit={can('task.update')}
          canCreate={Boolean(listId) && can('task.create')}
          onOpen={onOpen}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
}
