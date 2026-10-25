import { PlusIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { TASK_TITLE_MAX } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';
import { useTaskMutations } from '../../hooks/use-task-mutations';

interface QuickAddTaskProps {
  workspaceId: string;
  listId: string;
  statusId: string;
  className?: string;
}

/** Inline "add a task" row. Enter saves and keeps the field open for the next one. */
export function QuickAddTask({ workspaceId, listId, statusId, className }: QuickAddTaskProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const { create } = useTaskMutations(workspaceId);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return setEditing(false);
    create.mutate({ listId, body: { title: trimmed, statusId } }, { onSuccess: () => setTitle('') });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn('flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground', className)}
      >
        <PlusIcon className="size-4" /> Add task
      </button>
    );
  }

  return (
    <form onSubmit={submit} className={cn('px-1 py-1', className)}>
      <input
        autoFocus
        value={title}
        maxLength={TASK_TITLE_MAX}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => !title.trim() && setEditing(false)}
        onKeyDown={(event) => event.key === 'Escape' && setEditing(false)}
        placeholder="Task name, then Enter"
        aria-label="New task name"
        className="h-9 w-full rounded-md border border-primary/50 bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={create.isPending}
      />
    </form>
  );
}
