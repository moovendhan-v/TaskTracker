import { useState, type DragEvent } from 'react';
import type { TaskResponse, TaskStatusResponse } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';
import { QuickAddTask } from '../shared/quick-add-task';
import { StatusPill } from '@/components/kit/status-pill';
import { TaskCard } from './task-card';

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
}

export function BoardColumn({ workspaceId, listId, spaceId, status, tasks, canEdit, canCreate, onOpen, onDrop }: BoardColumnProps) {
  const [over, setOver] = useState(false);

  return (
    <section
      aria-label={status.name}
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
      className={cn('flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors', over && 'border-primary/50 bg-accent')}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <h3>
          <StatusPill status={status} />
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground">{tasks.length}</span>
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
        {canCreate ? <QuickAddTask workspaceId={workspaceId} listId={listId} spaceId={spaceId} statusId={status.id} /> : null}
      </div>
    </section>
  );
}
