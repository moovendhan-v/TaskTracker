import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CHECKLIST_TITLE_MAX, checklistProgress, TASK_CHECKLIST_MAX, type ChecklistItemResponse, type TaskResponse } from '@taskflow/shared-types';
import { ArrowDownIcon, ArrowUpIcon, ListChecksIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { notify } from '@/components/kit/notify';
import { Section } from '@/components/kit/section';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { queryKeys } from '@/lib/query-keys';
import { usePermissions } from '@/modules/workspaces';
import { checklistApi } from '../../api/attachments.api';

/** Under tasksRoot, so the live 'task_checklist' event refreshes it everywhere. */
export const checklistKey = (workspaceId: string, taskId: string) => [...queryKeys.tasksRoot(workspaceId), 'checklist', taskId] as const;

/**
 * The task's checklist (C2): steps to tick off, in order, with how far along it is. People
 * who can edit the task add, rename, tick, reorder and remove steps; everyone who can see
 * the task sees them (and who ticked each one).
 */
export function TaskChecklist({ workspaceId, task }: { workspaceId: string; task: TaskResponse }) {
  const queryClient = useQueryClient();
  const { canIn } = usePermissions(workspaceId);
  const canEdit = canIn(task.spaceId, 'task.update');
  const key = checklistKey(workspaceId, task.id);
  const { data: steps = [] } = useQuery({ queryKey: key, queryFn: () => checklistApi.list(workspaceId, task.id) });
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const progress = checklistProgress(steps);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const run = async (work: () => Promise<unknown>) => {
    try {
      await work();
    } catch (error) {
      notify.error(error);
    } finally {
      void refresh();
    }
  };

  const add = async () => {
    const title = draft.trim();
    if (!title) return;
    setDraft('');
    await run(() => checklistApi.add(workspaceId, task.id, title));
  };
  const tick = (step: ChecklistItemResponse, done: boolean) => {
    // Shown at once; the server's answer (who ticked it) follows.
    queryClient.setQueryData<ChecklistItemResponse[]>(key, (current) => current?.map((item) => (item.id === step.id ? { ...item, done } : item)));
    void run(() => checklistApi.update(workspaceId, step.id, { done }));
  };
  const rename = async () => {
    if (!editing) return;
    const { id, title } = editing;
    setEditing(null);
    const step = steps.find((item) => item.id === id);
    if (!step || !title.trim() || title.trim() === step.title) return;
    await run(() => checklistApi.update(workspaceId, id, { title }));
  };
  const move = (index: number, by: -1 | 1) => {
    const step = steps[index]!;
    // Before the step that will follow it: two ahead going down (or the end), one back going up.
    const before = by === -1 ? steps[index - 1]!.id : (steps[index + 2]?.id ?? null);
    void run(() => checklistApi.move(workspaceId, step.id, before));
  };

  if (!canEdit && steps.length === 0) return null;
  return (
    <Section
      storageKey="task-detail:checklist"
      className="border-t pt-4"
      title={
        <span className="flex items-center gap-2 text-sm font-semibold">
          <ListChecksIcon className="size-4 text-muted-foreground" /> Checklist
        </span>
      }
      actions={
        progress.total ? (
          <span className="font-mono text-xs text-muted-foreground" aria-label={`${progress.done} of ${progress.total} steps done`}>
            {progress.done}/{progress.total}
          </span>
        ) : undefined
      }
    >
      <div className="grid gap-2 pt-1">
        {progress.total ? (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Checklist progress" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <div className="h-full rounded-full bg-good transition-[width]" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        ) : null}
        <ul aria-label="Steps" className="grid gap-0.5">
          {steps.map((step, index) => (
            <li key={step.id} className="group/step flex min-h-8 items-center gap-2 rounded-md px-1 hover:bg-muted/50">
              <Checkbox
                checked={step.done}
                disabled={!canEdit}
                onCheckedChange={(checked) => tick(step, checked === true)}
                aria-label={`${step.done ? 'Untick' : 'Tick'} “${step.title}”`}
              />
              {editing?.id === step.id ? (
                <Input
                  autoFocus
                  value={editing.title}
                  maxLength={CHECKLIST_TITLE_MAX}
                  aria-label="Step"
                  className="h-7"
                  onChange={(event) => setEditing({ id: step.id, title: event.target.value })}
                  onBlur={() => void rename()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void rename();
                    if (event.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setEditing({ id: step.id, title: step.title })}
                  title={step.done && step.doneByName ? `Done by ${step.doneByName}` : undefined}
                  className={cn('min-w-0 flex-1 truncate text-left text-sm disabled:cursor-default', step.done && 'text-muted-foreground line-through')}
                >
                  {step.title}
                </button>
              )}
              {canEdit && editing?.id !== step.id ? (
                <span className="flex shrink-0 opacity-0 transition-opacity group-focus-within/step:opacity-100 group-hover/step:opacity-100">
                  <Button variant="ghost" size="icon-sm" aria-label={`Move “${step.title}” up`} disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUpIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Move “${step.title}” down`} disabled={index === steps.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDownIcon />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove “${step.title}”`} onClick={() => void run(() => checklistApi.remove(workspaceId, step.id))}>
                    <XIcon />
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit && steps.length < TASK_CHECKLIST_MAX ? (
          <Input
            value={draft}
            maxLength={CHECKLIST_TITLE_MAX}
            placeholder="Add a step, then press Enter"
            aria-label="New step"
            className="h-8"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void add();
              }
            }}
          />
        ) : null}
      </div>
    </Section>
  );
}
