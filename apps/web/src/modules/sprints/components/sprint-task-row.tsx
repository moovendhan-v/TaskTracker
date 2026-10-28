import { GripVerticalIcon, Undo2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { TaskResponse } from '@taskflow/shared-types';
import { UserAvatar } from '@/components/common/user-avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/cn';
import { PriorityIcon, StatusDot, isClosed } from '@/modules/tasks';
import { formatMinutes } from '../lib/sprint-metrics';

/** What a dragged planning row carries: the task id. */
export const SPRINT_TASK_DRAG = 'application/x-taskflow-plan-task';

interface SprintTaskRowProps {
  task: TaskResponse;
  assigneeName: string | null;
  draggable: boolean;
  onOpen: () => void;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  /** Takes the task out of its sprint, back to the backlog. */
  onUnplan?: () => void;
  trailing?: ReactNode;
}

/** One task in a planning list: drag it to another sprint, or select several to move at once. */
export function SprintTaskRow({ task, assigneeName, draggable, onOpen, selected, onSelect, onUnplan, trailing }: SprintTaskRowProps) {
  const closed = isClosed(task);
  return (
    <li
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData(SPRINT_TASK_DRAG, task.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      className={cn('group flex items-center gap-2 bg-card px-2 py-1.5 text-sm hover:bg-muted/50', draggable && 'cursor-grab active:cursor-grabbing')}
    >
      {draggable ? <GripVerticalIcon className="size-3.5 shrink-0 text-muted-foreground/60 opacity-0 group-hover:opacity-100" aria-hidden /> : null}
      {onSelect ? <Checkbox checked={selected} onCheckedChange={(checked) => onSelect(checked === true)} aria-label={`Select ${task.title}`} /> : null}
      <StatusDot status={task.status} />
      <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">#{task.number}</span>
      <button type="button" onClick={onOpen} className={cn('min-w-0 flex-1 truncate text-left hover:text-primary', closed && 'text-muted-foreground line-through')}>
        {task.title}
      </button>
      {task.priority !== 'none' ? <PriorityIcon priority={task.priority} /> : null}
      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground" title="Estimate">
        {formatMinutes(task.estimateMinutes ?? 0)}
      </span>
      {assigneeName ? <UserAvatar name={assigneeName} className="size-6 text-[10px]" showTooltip /> : <span className="size-6 shrink-0 rounded-full border border-dashed" title="Unassigned" />}
      {trailing}
      {onUnplan ? (
        <button
          type="button"
          onClick={onUnplan}
          className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
          aria-label={`Move ${task.title} back to the backlog`}
          title="Back to backlog"
        >
          <Undo2Icon className="size-3.5" />
        </button>
      ) : null}
    </li>
  );
}
