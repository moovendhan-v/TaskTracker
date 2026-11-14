import { useState, type DragEvent } from 'react';
import type { TaskResponse, TaskStatusResponse } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';
import { QuickAddTask } from '../shared/quick-add-task';
import { StatusPill } from '@/components/kit/status-pill';
import { TaskCard } from './task-card';
import { wipState } from '../../lib/board-lanes';

interface BoardColumnProps {
  workspaceId: string;
  listId: string | undefined;
  spaceId: string;
  status: TaskStatusResponse;
  tasks: TaskResponse[];
  canEdit: boolean;
  canCreate: boolean;
  onOpen: (taskId: string) => void;
  onDrop: (event: DragEvent, status: TaskStatusResponse, beforeTaskId: string | null) => void;
  /** Tasks in this status across the whole board, for the limit (lanes show part of a column). */
  columnCount?: number;
  /** In a swimlane: no header (the board shows one per column), and a label for the cell. */
  laneLabel?: string;
}

/** A column's name, count and work-in-progress limit (amber at it, red over it). */
export function ColumnHeader({ status, count }: { status: TaskStatusResponse; count: number }) {
  const state = wipState(count, status.wipLimit);
  return (
    <header className="flex items-center gap-2 px-3 py-2.5">
      <h3>
        <StatusPill status={status} />
      </h3>
      {status.wipLimit === null ? (
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      ) : (
        <span
          className={cn('rounded-full px-1.5 text-xs font-medium tabular-nums', state === 'over' ? 'bg-critical/15 text-critical' : state === 'at' ? 'bg-warning/15 text-warning' : 'text-muted-foreground')}
          aria-label={`${count} of a limit of ${status.wipLimit}${state === 'over' ? ', over the limit' : state === 'at' ? ', at the limit' : ''}`}
          title={state === 'over' ? 'Over this column’s work-in-progress limit' : state === 'at' ? 'At this column’s work-in-progress limit' : 'Work-in-progress limit'}
        >
          {count} / {status.wipLimit}
        </span>
      )}
    </header>
  );
}

export function BoardColumn({ workspaceId, listId, spaceId, status, tasks, canEdit, canCreate, onOpen, onDrop, columnCount, laneLabel }: BoardColumnProps) {
  const [over, setOver] = useState(false);

  return (
    <section
      aria-label={laneLabel ? `${status.name}, ${laneLabel}` : status.name}
      onDragOver={(event) => {
        if (!canEdit) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false);
        onDrop(event, status, null);
      }}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors',
        over && 'border-primary/50 bg-accent',
        !laneLabel && wipState(columnCount ?? tasks.length, status.wipLimit) === 'over' && 'border-critical/40',
      )}
    >
      {laneLabel ? null : <ColumnHeader status={status} count={columnCount ?? tasks.length} />}
      <div className={cn('flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2', laneLabel && 'pt-2')}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            workspaceId={workspaceId}
            task={task}
            draggable={canEdit}
            onOpen={onOpen}
            onDropBefore={(event, beforeTaskId) => {
              event.stopPropagation();
              setOver(false);
              onDrop(event, status, beforeTaskId);
            }}
          />
        ))}
        {canCreate ? <QuickAddTask workspaceId={workspaceId} listId={listId} spaceId={spaceId} statusId={status.id} /> : null}
      </div>
    </section>
  );
}
