import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { isMenuOpen, isPlainShortcut } from '@/lib/keys';
import { neighbours, useTaskSequenceStore } from '../../store/task-sequence.store';

/**
 * Previous / next task in the view behind the preview (list or board order).
 * Keys: k or ↑ for the previous task, j or ↓ for the next; never while typing,
 * with a menu open, or with another dialog on top. Hidden when the task isn't
 * in a view's list (opened from search, the inbox, a link).
 */
export function TaskStepper({ taskId, onOpen }: { taskId: string; onOpen: (taskId: string) => void }) {
  const ids = useTaskSequenceStore((state) => state.ids);
  const { index, total, previous, next } = neighbours(ids, taskId);

  useEffect(() => {
    if (index === -1) return;
    const onKey = (event: KeyboardEvent) => {
      if (!isPlainShortcut(event) || isMenuOpen() || document.querySelectorAll('[role="dialog"],[role="alertdialog"]').length > 1) return;
      const key = event.key.toLowerCase();
      const target = key === 'k' || event.key === 'ArrowUp' ? previous : key === 'j' || event.key === 'ArrowDown' ? next : undefined;
      if (target === undefined) return;
      event.preventDefault();
      if (target) onOpen(target);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, previous, next, onOpen]);

  if (index === -1 || total < 2) return null;
  return (
    <span className="ml-auto flex items-center gap-1">
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums" aria-live="polite">
        {index + 1} of {total}
      </span>
      <Button variant="ghost" size="icon-sm" aria-label="Previous task" title="Previous task (k or ↑)" disabled={!previous} onClick={() => previous && onOpen(previous)}>
        <ChevronUpIcon />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Next task" title="Next task (j or ↓)" disabled={!next} onClick={() => next && onOpen(next)}>
        <ChevronDownIcon />
      </Button>
    </span>
  );
}
