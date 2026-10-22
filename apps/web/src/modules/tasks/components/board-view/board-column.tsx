import { useState, type DragEvent } from 'react';
import type { TaskResponse, TaskStatus } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';
import { STATUS_META } from '../../lib/task-meta';
import { QuickAddTask } from '../shared/quick-add-task';
import { StatusDot } from '../shared/status-picker';
import { TaskCard } from './task-card';

interface BoardColumnProps {
  workspaceId: string;
  listId: string | undefined;
  status: TaskStatus;
  tasks: TaskResponse[];
  canEdit: boolean;
  canCreate: boolean;
  onOpen: (taskId: string) => void;
  onDrop: (event: DragEvent, status: TaskStatus, beforeTaskId: string | null) => void;
}

export function BoardColumn({ workspaceId, listId, status, tasks, canEdit, canCreate, onOpen, onDrop }: BoardColumnProps) {
  const [over, setOver] = useState(false);

  return (
    <section
      aria-label={STATUS_META[status].label}
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
      className={cn('flex w-72 shrink-0 flex-col rounded-xl bg-muted/60 transition-colors', over && 'bg-accent')}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <StatusDot status={status} />
        <h3 className="text-sm font-semibold">{STATUS_META[status].label}</h3>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </header>
      <div className="flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
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
        {canCreate && listId ? <QuickAddTask workspaceId={workspaceId} listId={listId} status={status} /> : null}
      </div>
    </section>
  );
}
