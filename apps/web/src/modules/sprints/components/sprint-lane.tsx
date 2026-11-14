import { Link } from '@tanstack/react-router';
import { ChevronRightIcon, KanbanIcon, MoreHorizontalIcon, PencilIcon, PlayIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import type { SprintResponse } from '@taskflow/shared-types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { useMemberName } from '@/modules/members';
import { formatPoints, useTaskMutations } from '@/modules/tasks';
import { useSprintTasks } from '../hooks/use-sprints';
import { formatSprintRange } from '../lib/sprint-dates';
import { formatMinutes, summarize } from '../lib/sprint-metrics';
import { SprintCapacity } from './sprint-capacity';
import { SprintFormDialog, type SprintFormValues } from './sprint-form-dialog';
import { SPRINT_TASK_DRAG, SprintTaskRow } from './sprint-task-row';

interface SprintLaneProps {
  workspaceId: string;
  sprint: SprintResponse;
  canManage: boolean;
  /** A space has at most one active sprint, so planned sprints can only start when none is running. */
  canStart: boolean;
  onOpenTask: (taskId: string) => void;
  onStart: () => Promise<unknown>;
  onUpdate: (values: SprintFormValues) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}

/** A sprint as a drop zone in planning: its tasks, their size, and what you can do with it. */
export function SprintLane({ workspaceId, sprint, canManage, canStart, onOpenTask, onStart, onUpdate, onDelete }: SprintLaneProps) {
  const [open, setOpen] = useState(true);
  const [over, setOver] = useState(false);
  const tasks = useSprintTasks(workspaceId, sprint.id);
  const { update } = useTaskMutations(workspaceId);
  const nameOf = useMemberName(workspaceId);
  const items = tasks.data ?? [];
  const summary = summarize(items);
  const active = sprint.status === 'active';

  return (
    <section
      aria-label={sprint.name}
      onDragOver={(event) => {
        if (!canManage || !event.dataTransfer.types.includes(SPRINT_TASK_DRAG)) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false);
        const taskId = event.dataTransfer.getData(SPRINT_TASK_DRAG);
        if (taskId && !items.some((task) => task.id === taskId)) update.mutate({ taskId, body: { sprintId: sprint.id } });
      }}
      className={cn('overflow-hidden rounded-xl border bg-card transition-shadow', active && 'border-primary/40', over && 'ring-2 ring-primary')}
    >
      <header className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${sprint.name}`} className="rounded p-0.5 text-muted-foreground hover:bg-muted">
          <ChevronRightIcon className={cn('size-4 transition-transform', open && 'rotate-90')} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="truncate">{sprint.name}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>{active ? 'Active' : 'Planned'}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {formatSprintRange(sprint.startDate, sprint.endDate)} · {summary.total} {summary.total === 1 ? 'task' : 'tasks'} · {summary.points ? `${formatPoints(summary.points)} · ` : ''}
            {formatMinutes(summary.estimateMinutes)} estimated
            {sprint.goal ? ` · ${sprint.goal}` : ''}
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/w/$workspaceId/sprints/$sprintId" params={{ workspaceId, sprintId: sprint.id }}>
            <KanbanIcon /> Board
          </Link>
        </Button>
        {canManage && sprint.status === 'planned' ? (
          <Button size="sm" variant="outline" disabled={!canStart} title={canStart ? undefined : 'Complete the active sprint first'} onClick={() => void onStart()}>
            <PlayIcon /> Start
          </Button>
        ) : null}
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`${sprint.name} options`}>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <SprintFormDialog
                formName="sprint.update"
                trigger={
                  <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
                    <PencilIcon /> Edit
                  </DropdownMenuItem>
                }
                title="Edit sprint"
                submitLabel="Save"
                defaultValues={{ name: sprint.name, goal: sprint.goal, startDate: sprint.startDate, endDate: sprint.endDate }}
                onSubmit={onUpdate}
              />
              {sprint.status === 'planned' ? (
                <>
                  <DropdownMenuSeparator />
                  <ConfirmDialog
                    trigger={
                      <DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>
                        <TrashIcon /> Delete
                      </DropdownMenuItem>
                    }
                    title={`Delete ${sprint.name}?`}
                    description="Its tasks go back to the backlog."
                    confirmLabel="Delete sprint"
                    onConfirm={onDelete}
                  />
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>
      {open ? <SprintCapacity workspaceId={workspaceId} sprint={sprint} tasks={items} canSeeLeave={canManage} /> : null}
      {open ? (
        items.length === 0 ? (
          <p className={cn('px-4 py-6 text-center text-sm text-muted-foreground', over && 'text-primary')}>
            {canManage ? 'Drag tasks here from the backlog, or select some and use “Move to”.' : 'No tasks planned yet.'}
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((task) => (
              <SprintTaskRow
                key={task.id}
                task={task}
                assigneeName={nameOf(task.assigneeId)}
                draggable={canManage}
                onOpen={() => onOpenTask(task.id)}
                onUnplan={canManage ? () => update.mutate({ taskId: task.id, body: { sprintId: null } }) : undefined}
              />
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
