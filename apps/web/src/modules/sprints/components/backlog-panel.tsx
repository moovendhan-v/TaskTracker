import { InboxIcon, SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SprintResponse } from '@taskflow/shared-types';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { useMemberName } from '@/modules/members';
import { useTaskMutations } from '@/modules/tasks';
import { useBacklog } from '../hooks/use-sprints';
import { formatMinutes } from '../lib/sprint-metrics';
import { SPRINT_TASK_DRAG, SprintTaskRow } from './sprint-task-row';

const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3, none: 4 } as const;

interface BacklogPanelProps {
  workspaceId: string;
  spaceId: string;
  /** Sprints that can still take tasks (planned or active). */
  openSprints: SprintResponse[];
  canPlan: boolean;
  onOpenTask: (taskId: string) => void;
}

/** Unplanned work, most urgent first: drag rows onto a sprint, or select several and move them together. */
export function BacklogPanel({ workspaceId, spaceId, openSprints, canPlan, onOpenTask }: BacklogPanelProps) {
  const { data: tasks = [] } = useBacklog(workspaceId, spaceId);
  const { update } = useTaskMutations(workspaceId);
  const nameOf = useMemberName(workspaceId);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [over, setOver] = useState(false);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tasks
      .filter((task) => !needle || task.title.toLowerCase().includes(needle) || `#${task.number}`.includes(needle))
      .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.position - b.position);
  }, [tasks, search]);
  const chosen = visible.filter((task) => selected.has(task.id));
  const estimate = visible.reduce((sum, task) => sum + (task.estimateMinutes ?? 0), 0);

  const select = (taskId: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  const moveSelected = (sprintId: string) => {
    for (const task of chosen) update.mutate({ taskId: task.id, body: { sprintId } });
    setSelected(new Set());
  };

  return (
    <section
      aria-label="Backlog"
      onDragOver={(event) => {
        if (!canPlan || !event.dataTransfer.types.includes(SPRINT_TASK_DRAG)) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false);
        const taskId = event.dataTransfer.getData(SPRINT_TASK_DRAG);
        if (taskId && !tasks.some((task) => task.id === taskId)) update.mutate({ taskId, body: { sprintId: null } });
      }}
      className={cn('flex max-h-[calc(100dvh-14rem)] min-h-64 flex-col overflow-hidden rounded-xl border bg-card lg:sticky lg:top-4', over && 'ring-2 ring-primary')}
    >
      <header className="grid gap-2 border-b bg-muted/30 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <InboxIcon className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Backlog</h2>
          <span className="text-xs text-muted-foreground">
            {tasks.length} unplanned · {formatMinutes(estimate)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {canPlan && visible.length > 0 ? (
            <Checkbox
              aria-label="Select all shown"
              checked={chosen.length > 0 && chosen.length === visible.length ? true : chosen.length > 0 ? 'indeterminate' : false}
              onCheckedChange={(checked) => setSelected(checked === true ? new Set(visible.map((task) => task.id)) : new Set())}
            />
          ) : null}
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter the backlog"
              aria-label="Filter the backlog"
              maxLength={100}
              className="h-8 w-full rounded-md border bg-background pr-2 pl-7 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {canPlan ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" disabled={chosen.length === 0 || openSprints.length === 0}>
                  Move {chosen.length || ''} to…
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Plan into</DropdownMenuLabel>
                {openSprints.map((sprint) => (
                  <DropdownMenuItem key={sprint.id} onSelect={() => moveSelected(sprint.id)}>
                    {sprint.name}
                    <span className="ml-auto text-xs text-muted-foreground">{sprint.status === 'active' ? 'active' : 'planned'}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </header>
      {tasks.length === 0 ? (
        <div className="p-4">
          <EmptyState title="Backlog is clear" description="Unfinished tasks that aren't in a sprint show up here." />
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
          {visible.map((task) => (
            <SprintTaskRow
              key={task.id}
              task={task}
              assigneeName={nameOf(task.assigneeId)}
              draggable={canPlan}
              onOpen={() => onOpenTask(task.id)}
              selected={selected.has(task.id)}
              onSelect={canPlan ? (on) => select(task.id, on) : undefined}
            />
          ))}
          {visible.length === 0 ? <li className="p-4 text-center text-sm text-muted-foreground">Nothing matches.</li> : null}
        </ul>
      )}
    </section>
  );
}
