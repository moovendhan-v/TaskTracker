import { PlusIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { TASK_TITLE_MAX, type CreateTaskRequest } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';
import { useTaskMutations } from '../../hooks/use-task-mutations';

interface QuickAddTaskProps {
  workspaceId: string;
  listId: string;
  /** Status for new tasks; the space's first status when left out. */
  statusId?: string;
  /** Other fields new tasks start with, e.g. the group's priority or assignee. */
  defaults?: Partial<CreateTaskRequest>;
  startOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

/** Inline "add a task" row. Enter saves and keeps the field open for the next one. */
export function QuickAddTask({ workspaceId, listId, statusId, defaults, startOpen = false, onClose, className }: QuickAddTaskProps) {
  const [editing, setOpen] = useState(startOpen);
  const setEditing = (open: boolean) => {
    setOpen(open);
    if (!open) onClose?.();
  };
  const [title, setTitle] = useState('');
  const { create } = useTaskMutations(workspaceId);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return setEditing(false);
    create.mutate({ listId, body: { ...defaults, title: trimmed, ...(statusId && { statusId }) } }, { onSuccess: () => setTitle('') });
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
        placeholder="Task name — Enter to save, Esc to cancel"
        aria-label="New task name"
        className="h-9 w-full rounded-md border border-primary/50 bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={create.isPending}
      />
    </form>
  );
}
