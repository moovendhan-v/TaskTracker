import { SearchIcon } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { StatusPill } from '@/components/kit/status-pill';
import { Modal } from '@/components/kit/modal';
import { cn } from '@/lib/cn';
import { useTaskSearch } from '../hooks/use-tasks';

/**
 * The top bar's search: find a task by name or number from anywhere, with
 * Cmd/Ctrl+K. Enter opens the highlighted task.
 */
export function CommandSearch({ workspaceId, onOpen }: { workspaceId: string; onOpen: (taskId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const search = useDeferredValue(text.trim().replace(/^#/, ''));
  const results = useTaskSearch(workspaceId, {}, { search: search || null, sort: [{ field: 'updatedAt', direction: 'desc' }] }, open);
  const items = (results.data?.items ?? []).slice(0, 12);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const choose = (taskId: string) => {
    setOpen(false);
    setText('');
    onOpen(taskId);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-full max-w-xl items-center gap-2 rounded-lg border bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-muted"
      >
        <SearchIcon className="size-4" />
        <span className="flex-1 truncate text-left">Search tasks by name or number</span>
        <kbd className="rounded border bg-card px-1.5 font-mono text-[11px]">⌘K</kbd>
      </button>
      <Modal open={open} onOpenChange={setOpen} title="Search tasks" hideTitle size="md">
        <div className="relative border-b">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') setActive((index) => Math.min(items.length - 1, index + 1));
              if (event.key === 'ArrowUp') setActive((index) => Math.max(0, index - 1));
              if (event.key === 'Enter' && items[active]) choose(items[active].id);
            }}
            placeholder="Task name or #number"
            aria-label="Search tasks"
            role="combobox"
            aria-expanded
            aria-controls="command-results"
            className="h-12 w-full bg-transparent pr-4 pl-10 text-base outline-none"
          />
        </div>
        <ul id="command-results" role="listbox" aria-label="Tasks" className="max-h-96 overflow-y-auto p-2">
          {items.map((task, index) => (
            <li key={task.id} role="option" aria-selected={index === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(task.id)}
                className={cn('flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm', index === active && 'bg-muted')}
              >
                <span className="w-12 text-xs tabular-nums text-muted-foreground">#{task.number}</span>
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                <StatusPill status={task.status} />
              </button>
            </li>
          ))}
          {results.data && items.length === 0 ? <li className="p-6 text-center text-sm text-muted-foreground">No tasks match “{text}”.</li> : null}
        </ul>
      </Modal>
    </>
  );
}
