import { isClosedCategory, type CompleteSprintRequest, type SprintResponse } from '@taskflow/shared-types';
import { ArrowRightIcon, CheckCircle2Icon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { StatusPill } from '@/components/kit/status-pill';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { useSprintTasks } from '../hooks/use-sprints';
import { localToday, sprintTiming, summarize } from '../lib/sprint-metrics';

const BACKLOG = 'backlog';
type Step = 1 | 2 | 3;

interface CompleteSprintDialogProps {
  trigger: ReactNode;
  workspaceId: string;
  sprint: SprintResponse;
  plannedSprints: SprintResponse[];
  onComplete: (request: CompleteSprintRequest) => Promise<unknown>;
}

const selectClass = 'h-8 rounded-md border bg-card px-2 text-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-primary-soft focus-visible:outline-none';

/**
 * Completing a sprint in three steps (v2 Features #15b): what got done, where each
 * unfinished task goes (the backlog or a planned sprint), then a last check.
 * Everything is sent in one request, so it happens all at once or not at all.
 */
export function CompleteSprintDialog({ trigger, workspaceId, sprint, plannedSprints, onComplete }: CompleteSprintDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [defaultTarget, setDefaultTarget] = useState(plannedSprints[0]?.id ?? BACKLOG);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const tasks = useSprintTasks(workspaceId, sprint.id);
  const items = tasks.data ?? [];
  const unfinished = items.filter((task) => !isClosedCategory(task.status.category));
  const summary = summarize(items);
  const timing = sprintTiming(sprint, localToday());
  const destinationOf = (taskId: string) => overrides[taskId] ?? defaultTarget;
  const nameOf = (target: string) => (target === BACKLOG ? 'Backlog' : (plannedSprints.find((planned) => planned.id === target)?.name ?? 'Sprint'));
  const counts = unfinished.reduce<Record<string, number>>((acc, task) => ({ ...acc, [destinationOf(task.id)]: (acc[destinationOf(task.id)] ?? 0) + 1 }), {});

  const reset = (next: boolean) => {
    setOpen(next);
    if (next) {
      setStep(1);
      setOverrides({});
      setDefaultTarget(plannedSprints[0]?.id ?? BACKLOG);
    }
  };

  async function complete() {
    setBusy(true);
    try {
      const moves = unfinished
        .filter((task) => destinationOf(task.id) !== defaultTarget)
        .map((task) => ({ taskId: task.id, sprintId: destinationOf(task.id) === BACKLOG ? null : destinationOf(task.id) }));
      await onComplete({ moveOpenTasksToSprintId: defaultTarget === BACKLOG ? null : defaultTarget, moves });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const options = (
    <>
      <option value={BACKLOG}>Backlog</option>
      {plannedSprints.map((planned) => (
        <option key={planned.id} value={planned.id}>
          {planned.name}
        </option>
      ))}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <p className="font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase">
            Step {step} of 3 · {step === 1 ? 'Summary' : step === 2 ? 'Unfinished work' : 'Review'}
          </p>
          <DialogTitle>Complete {sprint.name}</DialogTitle>
          <DialogDescription>
            {summary.done} of {summary.total} tasks done
            {unfinished.length ? `. ${unfinished.length} unfinished ${unfinished.length === 1 ? 'task needs' : 'tasks need'} somewhere to go.` : '. Nothing is left over.'}
          </DialogDescription>
        </DialogHeader>
        <ol aria-hidden className="flex gap-1">
          {[1, 2, 3].map((index) => (
            <li key={index} className={cn('h-1 flex-1 rounded-full', index <= step ? 'bg-ring' : 'bg-muted')} />
          ))}
        </ol>

        {step === 1 ? (
          <dl className="grid grid-cols-3 gap-3">
            {[
              ['Done', `${summary.donePercent}%`, `${summary.done} of ${summary.total} tasks`],
              ['Unfinished', String(unfinished.length), `${summary.blocked} blocked`],
              ['Time used', `${timing.elapsedDays}/${timing.totalDays}`, 'days'],
            ].map(([label, value, hint]) => (
              <div key={label} className="rounded-lg border bg-card p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-mono text-xl font-semibold">{value}</dd>
                <dd className="text-xs text-muted-foreground">{hint}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {step === 2 ? (
          unfinished.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg border bg-card p-4 text-sm">
              <CheckCircle2Icon className="size-4 text-good" /> Everything in this sprint is done.
            </p>
          ) : (
            <div className="grid gap-3">
              <label className="flex items-center gap-2 text-sm">
                Move all to
                <select
                  value={defaultTarget}
                  onChange={(event) => {
                    setDefaultTarget(event.target.value);
                    setOverrides({});
                  }}
                  className={selectClass}
                >
                  {options}
                </select>
                <span className="text-xs text-muted-foreground">or choose per task</span>
              </label>
              <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
                {unfinished.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="font-mono text-[11.5px] text-subtle-foreground">#{task.number}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                    <StatusPill status={task.status} size="xs" />
                    <select
                      aria-label={`Destination for ${task.title}`}
                      value={destinationOf(task.id)}
                      onChange={(event) => setOverrides((current) => ({ ...current, [task.id]: event.target.value }))}
                      className={cn(selectClass, 'w-32')}
                    >
                      {options}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )
        ) : null}

        {step === 3 ? (
          <div className="grid gap-2 text-sm">
            <p>Completing marks {sprint.name} as done. It can't be edited afterwards.</p>
            {Object.entries(counts).map(([target, count]) => (
              <p key={target} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <span className="font-mono">{count}</span> {count === 1 ? 'task' : 'tasks'} <ArrowRightIcon className="size-3.5 text-muted-foreground" />
                <span className="font-medium">{nameOf(target)}</span>
              </p>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep((step - 1) as Step)} disabled={busy}>
              Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep((step + 1) as Step)} disabled={tasks.isPending}>
              Next
            </Button>
          ) : (
            <Button onClick={() => void complete()} disabled={busy}>
              Complete sprint
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
