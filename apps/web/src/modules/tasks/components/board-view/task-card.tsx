import type { DragEvent } from 'react';
import type { TaskResponse } from '@taskflow/shared-types';
import { UserAvatar } from '@/components/common/user-avatar';
import { cn } from '@/lib/cn';
import { useMemberName } from '@/modules/members';
import { DueDateLabel } from '../shared/due-date';
import { PriorityIcon } from '../shared/priority-picker';

interface TaskCardProps {
  workspaceId: string;
  task: TaskResponse;
  draggable: boolean;
  onOpen: (taskId: string) => void;
  onDropBefore: (event: DragEvent, beforeTaskId: string) => void;
}

export const TASK_DRAG_TYPE = 'application/x-taskflow-task';

export function TaskCard({ workspaceId, task, draggable, onOpen, onDropBefore }: TaskCardProps) {
  const memberName = useMemberName(workspaceId);
  const assignee = memberName(task.assigneeId);

  return (
    <article
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData(TASK_DRAG_TYPE, task.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => onDropBefore(event, task.id)}
      className={cn('rounded-lg border bg-card p-3 shadow-xs transition hover:border-primary/40 hover:shadow-sm', draggable && 'cursor-grab active:cursor-grabbing')}
    >
      <button
        type="button"
        onClick={() => onOpen(task.id)}
        className={cn('block w-full text-left text-sm font-medium hover:text-primary', task.status === 'done' && 'text-muted-foreground line-through')}
      >
        {task.title}
      </button>
      <div className="mt-3 flex items-center gap-2">
        {task.priority !== 'none' ? <PriorityIcon priority={task.priority} className="size-3.5" /> : null}
        <DueDateLabel dueDate={task.dueDate} done={task.status === 'done'} />
        <span className="flex-1" />
        {assignee ? <UserAvatar name={assignee} className="size-6" showTooltip /> : null}
      </div>
    </article>
  );
}
