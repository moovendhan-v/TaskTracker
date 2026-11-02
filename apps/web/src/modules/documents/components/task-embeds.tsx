import { useQuery } from '@tanstack/react-query';
import { isClosedCategory, type TaskResponse } from '@taskflow/shared-types';
import { CalendarIcon, ListChecksIcon } from 'lucide-react';
import { createContext, useContext, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';
import { UserAvatar } from '@/components/common/user-avatar';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { StatusPill } from '@/components/kit/status-pill';
import { cn } from '@/lib/cn';
import { formatNumericDate } from '@/lib/periods';
import { useMemberName } from '@/modules/members';
import { tasksApi, useOpenTask, useTaskSearch } from '@/modules/tasks';
import { mentionAt, TASK_LIST_LABELS, taskListQuery, type TaskListPreset } from '../lib/task-embeds';

/** Which workspace a document's task references resolve in. Without it they render as plain text. */
const DocTasksContext = createContext<string | null>(null);

export function DocTasksProvider({ workspaceId, children }: { workspaceId: string; children: ReactNode }) {
  return <DocTasksContext.Provider value={workspaceId}>{children}</DocTasksContext.Provider>;
}

export function useDocWorkspace(): string | null {
  return useContext(DocTasksContext);
}

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** One task by its number, with the reader's own access; a task they can't see is simply "not available". */
function useTaskByNumber(workspaceId: string, number: number) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'tasks', 'by-number', number],
    queryFn: () => tasksApi.byNumber(workspaceId, number),
    staleTime: 30_000,
    retry: false,
  });
}

function assigneesOf(task: TaskResponse): string[] {
  return task.assigneeIds?.length ? task.assigneeIds : task.assigneeId ? [task.assigneeId] : [];
}

/** `#123` in running text. */
export function TaskChip({ number }: { number: number }) {
  const workspaceId = useDocWorkspace();
  if (!workspaceId) return <>#{number}</>;
  return <ResolvedTaskChip workspaceId={workspaceId} number={number} />;
}

function ResolvedTaskChip({ workspaceId, number }: { workspaceId: string; number: number }) {
  const task = useTaskByNumber(workspaceId, number);
  const openTask = useOpenTask();
  if (!task.data) {
    return (
      <span className="font-mono text-[0.9em] text-muted-foreground" title={task.isError ? 'This task is not available to you' : undefined}>
        #{number}
      </span>
    );
  }
  const done = isClosedCategory(task.data.status.category);
  return (
    <button
      type="button"
      onClick={() => openTask(task.data!.id)}
      title={`${task.data.status.name}: ${task.data.title}`}
      className="inline-flex max-w-[20rem] translate-y-[2px] items-center gap-1 rounded-md border bg-card px-1.5 py-px align-baseline text-[0.85em] leading-snug hover:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: task.data.status.color }} />
      <span className="font-mono text-muted-foreground">#{number}</span>
      <span className={cn('truncate', done && 'text-muted-foreground line-through')}>{task.data.title}</span>
    </button>
  );
}

/** `@{userId}` in chat: the person's name, highlighted when it's you. */
export function UserMention({ userId }: { userId: string }) {
  const workspaceId = useDocWorkspace();
  const nameOf = useMemberName(workspaceId ?? '');
  const { data: me } = useCurrentUser();
  const mine = me?.id === userId;
  return (
    <span className={cn('rounded px-0.5 font-medium', mine ? 'bg-ring/15 text-ring' : 'bg-primary-soft text-foreground')}>
      @{workspaceId ? (nameOf(userId) ?? 'someone') : 'someone'}
    </span>
  );
}

const frame = 'my-3 overflow-hidden rounded-xl border bg-card';

/** `:::task 123`: the task as a card. */
export function TaskEmbedCard({ number }: { number: number }) {
  const workspaceId = useDocWorkspace();
  if (!workspaceId) return <p className="font-mono text-sm text-muted-foreground">Task #{number}</p>;
  return <ResolvedTaskCard workspaceId={workspaceId} number={number} />;
}

function ResolvedTaskCard({ workspaceId, number }: { workspaceId: string; number: number }) {
  const task = useTaskByNumber(workspaceId, number);
  const openTask = useOpenTask();
  const nameOf = useMemberName(workspaceId);
  if (!task.data) {
    return (
      <div className={cn(frame, 'px-4 py-3 text-sm text-muted-foreground')}>
        <span className="font-mono">#{number}</span> {task.isPending ? 'Loading…' : 'is not available to you.'}
      </div>
    );
  }
  const { data } = task;
  return (
    <button type="button" onClick={() => openTask(data.id)} className={cn(frame, 'block w-full p-4 text-left transition-colors hover:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')}>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">#{data.number}</span>
        <StatusPill status={data.status} size="xs" />
        <span className="flex-1" />
        {data.dueDate ? (
          <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <CalendarIcon className="size-3" aria-hidden /> {formatNumericDate(data.dueDate)}
          </span>
        ) : null}
        <span className="flex -space-x-1.5">
          {assigneesOf(data).slice(0, 3).map((userId) => (
            <UserAvatar key={userId} name={nameOf(userId) ?? 'Member'} className="size-5 text-[9px] ring-2 ring-card" />
          ))}
        </span>
      </span>
      <span className="mt-1.5 block text-[15px] font-medium">{data.title}</span>
      {data.description ? <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{data.description}</span> : null}
    </button>
  );
}

/** `:::tasks <preset> limit=N`: a live list that is always current. */
export function TaskListEmbed({ preset, limit }: { preset: TaskListPreset; limit: number }) {
  const workspaceId = useDocWorkspace();
  if (!workspaceId) return <p className="text-sm text-muted-foreground">{TASK_LIST_LABELS[preset]}</p>;
  return <ResolvedTaskList workspaceId={workspaceId} preset={preset} limit={limit} />;
}

function ResolvedTaskList({ workspaceId, preset, limit }: { workspaceId: string; preset: TaskListPreset; limit: number }) {
  const [today] = useState(localToday);
  const tasks = useTaskSearch(workspaceId, {}, taskListQuery(preset, today));
  const openTask = useOpenTask();
  const items = tasks.data?.items.slice(0, limit) ?? [];
  const total = tasks.data?.total ?? 0;
  return (
    <section aria-label={TASK_LIST_LABELS[preset]} className={frame}>
      <header className="flex h-9 items-center gap-2 border-b px-4 text-[13px] font-semibold">
        <ListChecksIcon aria-hidden className="size-4 text-muted-foreground" />
        {TASK_LIST_LABELS[preset]}
        <span className="font-mono text-[11px] font-medium text-subtle-foreground">{tasks.data ? total : '…'}</span>
        <span className="ml-auto text-[11px] font-normal text-subtle-foreground">live</span>
      </header>
      {tasks.isError ? <p className="px-4 py-3 text-sm text-muted-foreground">Couldn't load these tasks.</p> : null}
      {tasks.data && items.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">Nothing here right now.</p> : null}
      {/* Reset the document's .markdown list styles (bullets, item spacing). */}
      <ul className="m-0 list-none divide-y p-0 [&>li]:m-0">
        {items.map((task) => (
          <li key={task.id}>
            <button type="button" onClick={() => openTask(task.id)} className="flex h-9 w-full items-center gap-2.5 px-4 text-left text-sm hover:bg-muted/50">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: task.status.color }} />
              <span className="w-12 shrink-0 font-mono text-[11.5px] text-subtle-foreground">#{task.number}</span>
              <span className="min-w-0 flex-1 truncate">{task.title}</span>
              {task.dueDate ? <span className="font-mono text-[11px] text-muted-foreground">{formatNumericDate(task.dueDate)}</span> : null}
            </button>
          </li>
        ))}
      </ul>
      {total > items.length ? <p className="border-t px-4 py-1.5 text-xs text-muted-foreground">+{total - items.length} more</p> : null}
    </section>
  );
}

/**
 * A textarea that suggests tasks after `#` (Features #16a autocomplete). ↑/↓ pick,
 * Enter or Tab inserts `#123`, Esc closes. Behaves like a plain textarea otherwise.
 */
export function TaskMentionTextarea({
  value,
  onValueChange,
  onKeyDown,
  onBlur,
  ref: forwardedRef,
  suggestionsAbove = false,
  ...props
}: Omit<ComponentProps<'textarea'>, 'value' | 'onChange'> & { value: string; onValueChange: (value: string) => void; suggestionsAbove?: boolean }) {
  const workspaceId = useDocWorkspace();
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const setRef = (element: HTMLTextAreaElement | null) => {
    ref.current = element;
    if (typeof forwardedRef === 'function') forwardedRef(element);
    else if (forwardedRef) forwardedRef.current = element;
  };
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [index, setIndex] = useState(0);
  const search = useTaskSearch(workspaceId ?? '', {}, { search: mention?.query || null, sort: [{ field: 'updatedAt', direction: 'desc' }] }, Boolean(workspaceId && mention));
  const options = mention ? (search.data?.items ?? []).slice(0, 6) : [];

  const track = (element: HTMLTextAreaElement) => {
    const found = mentionAt(element.value, element.selectionStart ?? element.value.length);
    setMention(found);
    setIndex(0);
  };

  const insert = (task: TaskResponse) => {
    const element = ref.current;
    if (!element || !mention) return;
    const caret = element.selectionStart ?? value.length;
    const next = `${value.slice(0, mention.start)}#${task.number} ${value.slice(caret)}`;
    onValueChange(next);
    setMention(null);
    const position = mention.start + String(task.number).length + 2;
    requestAnimationFrame(() => element.setSelectionRange(position, position));
  };

  const keys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (options.length) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setIndex((current) => (current + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insert(options[index]!);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMention(null);
        return;
      }
    }
    onKeyDown?.(event);
  };

  return (
    <div className="relative">
      <textarea
        {...props}
        ref={setRef}
        value={value}
        role="combobox"
        aria-expanded={options.length > 0}
        aria-autocomplete="list"
        onChange={(event) => {
          onValueChange(event.target.value);
          track(event.target);
        }}
        onKeyDown={keys}
        onClick={(event) => track(event.currentTarget)}
        onBlur={(event) => {
          onBlur?.(event);
          setTimeout(() => setMention(null), 150);
        }}
      />
      {options.length ? (
        <ul role="listbox" aria-label="Tasks" className={cn('absolute left-0 z-30 w-80 overflow-hidden rounded-lg border bg-popover p-1 text-sm shadow-popover', suggestionsAbove ? 'bottom-full mb-1' : 'top-full mt-1')}>
          {options.map((task, position) => (
            <li
              key={task.id}
              role="option"
              aria-selected={position === index}
              onMouseDown={(event) => {
                event.preventDefault();
                insert(task);
              }}
              className={cn('flex cursor-default items-center gap-2 rounded-md px-2 py-1.5', position === index && 'bg-selected')}
            >
              <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: task.status.color }} />
              <span className="font-mono text-[11.5px] text-subtle-foreground">#{task.number}</span>
              <span className="truncate">{task.title}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
