import type { DragEvent } from 'react';
import { isClosedCategory, type TaskResponse } from '@taskflow/shared-types';
import { UserAvatar } from '@/components/common/user-avatar';
import { cn } from '@/lib/cn';
import { isOverdue } from '@/lib/dates';
import { formatNumericDate } from '@/lib/periods';
import { useMemberName } from '@/modules/members';
import { PriorityIcon } from '../shared/priority-picker';
import { TypeBadge } from '../shared/type-badge';

interface TaskCardProps {
  workspaceId: string;
  task: TaskResponse;
  /** Shown after the number, e.g. the project name. */
  context?: string;
  draggable: boolean;
  onOpen: (taskId: string) => void;
  onDropBefore: (event: DragEvent, beforeTaskId: string) => void;
}

export const TASK_DRAG_TYPE = 'application/x-taskflow-task';

export function TaskCard({ workspaceId, task, context, draggable, onOpen, onDropBefore }: TaskCardProps) {
  const memberName = useMemberName(workspaceId);
  const assignee = memberName(task.assigneeId);
  const closed = isClosedCategory(task.status.category);

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
      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <TypeBadge type={task.type} />
        <span className="tabular-nums">#{task.number}</span>
        {context ? <span className="truncate">· {context}</span> : null}
      </div>
      <button
        type="button"
        onClick={() => onOpen(task.id)}
        className={cn('block w-full text-left text-sm font-semibold hover:text-primary', closed && 'text-muted-foreground line-through')}
      >
        {task.title}
      </button>
      <div className="mt-3 flex items-center gap-2">
        {assignee ? <UserAvatar name={assignee} className="size-6" showTooltip /> : null}
        {task.dueDate ? (
          <span className={cn('text-xs tabular-nums', !closed && isOverdue(task.dueDate) ? 'text-critical' : 'text-muted-foreground')}>{formatNumericDate(task.dueDate)}</span>
        ) : null}
        <span className="flex-1" />
        {task.priority !== 'none' ? <PriorityIcon priority={task.priority} className="size-3.5" /> : null}
      </div>
    </article>
  );
}
