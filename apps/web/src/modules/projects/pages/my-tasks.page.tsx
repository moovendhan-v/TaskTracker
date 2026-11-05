import { CheckSquareIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { isClosedCategory, type TaskResponse } from '@taskflow/shared-types';
import { ErrorState } from '@/components/common/error-state';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { Section } from '@/components/kit/section';
import { StatusPill } from '@/components/kit/status-pill';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { dayOf, shiftDay, today } from '@/lib/days';
import { formatNumericDate } from '@/lib/periods';
import { useSpaces } from '@/modules/spaces';
import { NewTaskDialog, PriorityIcon, TypeBadge, useOpenTask, useTaskSearch } from '@/modules/tasks';

const BUCKETS = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Next 7 days' },
  { key: 'later', label: 'Later' },
  { key: 'none', label: 'No due date' },
] as const;

function bucketOf(task: TaskResponse): (typeof BUCKETS)[number]['key'] {
  const due = dayOf(task.dueDate);
  const now = today();
  if (!due) return 'none';
  if (due < now) return 'overdue';
  if (due === now) return 'today';
  return due <= shiftDay(now, 7) ? 'week' : 'later';
}

/** Every open task assigned to the signed-in person, across projects, by when it's due. */
export function MyTasksPage({ workspaceId }: { workspaceId: string }) {
  const openTask = useOpenTask();
  const [creating, setCreating] = useState(false);
  const { data: spaces = [] } = useSpaces(workspaceId);
  const tasks = useTaskSearch(
    workspaceId,
    {},
    {
      filter: { and: [{ field: 'assigneeId', op: 'eq', value: '@me' }, { field: 'statusCategory', op: 'nin', values: ['done', 'cancelled'] }] },
      sort: [{ field: 'dueDate', direction: 'asc' }],
    },
  );
  const items = tasks.data?.items ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-5 px-4 py-4 md:px-6 md:py-6">
        <header className="flex items-center gap-3">
          <CheckSquareIcon className="size-5 text-primary" />
          <h1 className="flex-1 text-xl font-semibold">My tasks</h1>
          <span className="text-sm text-muted-foreground">{tasks.data?.total ?? 0} open</span>
          <Button size="sm" className="hidden sm:inline-flex" onClick={() => setCreating(true)}>
            <PlusIcon /> Task
          </Button>
        </header>
        {tasks.isLoading ? <FullPageSpinner /> : null}
        {tasks.isError ? <ErrorState error={tasks.error} onRetry={() => void tasks.refetch()} /> : null}
        {BUCKETS.map((bucket) => {
          const rows = items.filter((task) => bucketOf(task) === bucket.key);
          if (rows.length === 0) return null;
          return (
            <Section key={bucket.key} variant="card" storageKey={`my-tasks:${bucket.key}`} title={<span className={cn('font-semibold', bucket.key === 'overdue' && 'text-critical')}>{bucket.label}</span>} count={rows.length}>
              <ul className="divide-y border-t">
                {rows.map((task) => (
                  <li key={task.id}>
                    <button type="button" onClick={() => openTask(task.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2 text-left text-sm hover:bg-muted/50 md:grid-cols-[3.5rem_5.5rem_minmax(0,1fr)_10rem_auto_6rem]">
                      <span className="hidden text-xs text-muted-foreground tabular-nums md:inline">#{task.number}</span>
                      <TypeBadge type={task.type} className="hidden justify-self-start md:inline-flex" />
                      <span className="min-w-0">
                        <span className={cn('block truncate font-medium', isClosedCategory(task.status.category) && 'line-through')}>{task.title}</span>
                        {/* On a phone the number, project and due date sit under the title. */}
                        <span className="flex min-w-0 gap-1.5 text-xs text-muted-foreground md:hidden">
                          <span className="tabular-nums">#{task.number}</span>
                          <span className="truncate">{spaces.find((space) => space.id === task.spaceId)?.name}</span>
                          {task.dueDate ? <span className={cn('ml-auto shrink-0 tabular-nums', bucket.key === 'overdue' && 'text-critical')}>{formatNumericDate(task.dueDate)}</span> : null}
                        </span>
                      </span>
                      <span className="hidden truncate text-xs text-muted-foreground md:inline">{spaces.find((space) => space.id === task.spaceId)?.name}</span>
                      <span className="flex items-center gap-2">
                        <PriorityIcon priority={task.priority} className="size-3.5" />
                        <StatusPill status={task.status} />
                      </span>
                      <span className={cn('hidden text-right tabular-nums md:inline', bucket.key === 'overdue' ? 'text-critical' : 'text-muted-foreground')}>{task.dueDate ? formatNumericDate(task.dueDate) : '–'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          );
        })}
        {tasks.data && items.length === 0 ? <p className="py-16 text-center text-muted-foreground">Nothing assigned to you. Enjoy the calm.</p> : null}
      </div>
      {creating ? <NewTaskDialog workspaceId={workspaceId} open onOpenChange={setCreating} onCreated={openTask} /> : null}
    </div>
  );
}
