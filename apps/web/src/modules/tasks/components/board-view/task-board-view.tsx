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
  /** Space whose statuses make the columns (fetched when `statuses` isn't given). */
  spaceId: string;
  statuses?: readonly TaskStatusResponse[];
  /** Set when new cards can be added in place; boards spanning lists leave it out. */
  listId?: string;
  tasks: readonly TaskResponse[];
  onOpen: (taskId: string) => void;
}

/** One column per status; drag a card to change its status or order. */
export function TaskBoardView({ workspaceId, spaceId, statuses: given, listId, tasks, onOpen }: TaskBoardViewProps) {
  const { update } = useTaskMutations(workspaceId);
  const { can, canIn } = usePermissions(workspaceId);
  const { data: fetched = [] } = useStatuses(workspaceId, given ? undefined : spaceId);
  const statuses = given ?? fetched;
  const byStatus = (statusId: string) => tasks.filter((task) => task.statusId === statusId).sort((a, b) => a.position - b.position);

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
          spaceId={spaceId}
          status={status}
          tasks={byStatus(status.id)}
          canEdit={spaceId ? canIn(spaceId, 'task.update') : can('task.update')}
          canCreate={Boolean(listId) && (spaceId ? canIn(spaceId, 'task.create') : can('task.create'))}
          onOpen={onOpen}
          onDrop={handleDrop}
        />
      ))}
    </div>
  );
}
