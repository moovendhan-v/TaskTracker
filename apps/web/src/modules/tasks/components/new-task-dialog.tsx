import { Dialog as DialogPrimitive } from 'radix-ui';
import { FlagIcon, Loader2Icon, TagIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useWatch } from 'react-hook-form';
import { TASK_DESCRIPTION_MAX, TASK_PRIORITIES, TASK_TITLE_MAX, TASK_TYPES, type TaskPriority, type TaskType } from '@taskflow/shared-types';
import { notify } from '@/components/kit/notify';
import { OptionPicker } from '@/components/kit/option-picker';
import { DateRangeField } from '@/components/kit/range-calendar';
import { StatusPill } from '@/components/kit/status-pill';
import { useServerForm } from '@/core/forms/use-server-form';
import { cn } from '@/lib/cn';
import { dayToIso, type Day } from '@/lib/days';
import { useLists } from '@/modules/lists';
import { useSpaces } from '@/modules/spaces';
import { useStatuses } from '../hooks/use-tasks';
import { useTaskMutations } from '../hooks/use-task-mutations';
import { PRIORITY_META, TYPE_META } from '../lib/task-meta';
import { PriorityIcon } from './shared/priority-picker';
import { AssigneePicker } from './shared/assignee-picker';
import { isPhone, useSwipeDismiss } from '@/lib/swipe';

interface Values {
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  statusId: string;
  assigneeId: string;
  assigneeIds: string[];
  startDate: string;
  dueDate: string;
}

interface NewTaskDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselects a list (and so its project). */
  listId?: string;
  spaceId?: string;
  /** Creates a subtask of this task. */
  parent?: { id: string; number: number };
  onCreated?: (taskId: string) => void;
}

const chip = 'flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/**
 * Creates a task in a project: name, description and a row of chips for the
 * rest. The project's first list is used unless a list was given, and the API
 * adds one if the project has none. Input is checked with the API's own
 * `task.create` rules.
 */
export function NewTaskDialog({ workspaceId, open, onOpenChange, listId: initialList, spaceId: initialSpace, parent, onCreated }: NewTaskDialogProps) {
  const { data: lists = [] } = useLists(workspaceId);
  const { data: spaces = [] } = useSpaces(workspaceId);
  const listSpace = lists.find((item) => item.id === initialList)?.spaceId;
  const [chosenSpace, setSpaceId] = useState<string | null>(initialSpace ?? null);
  const spaceId = chosenSpace ?? listSpace ?? spaces[0]?.id ?? null;
  const space = spaces.find((item) => item.id === spaceId);
  // A given list only applies while its project is the chosen one.
  const listId = initialList && listSpace === spaceId ? initialList : undefined;
  const { data: statuses = [] } = useStatuses(workspaceId, spaceId ?? undefined);
  const { create } = useTaskMutations(workspaceId);
  const [more, setMore] = useState(false);
  const [estimate, setEstimate] = useState('');

  // Mounted fresh for each use, so defaults are set once here.
  const { form, applyServerErrors, hints } = useServerForm<Values>('task.create', {
    defaultValues: { title: '', description: '', type: 'task', priority: 'none', statusId: '', assigneeId: '', assigneeIds: [], startDate: '', dueDate: '' },
  });
  const values = useWatch({ control: form.control });
  const { errors } = form.formState;
  const set = <K extends keyof Values>(key: K, value: Values[K]) => form.setValue(key, value as never, { shouldDirty: true });
  const status = statuses.find((item) => item.id === values.statusId) ?? statuses.find((item) => item.category === 'unstarted') ?? statuses[0];
  const firstError = Object.values(errors)[0]?.message;

  const submit = (another: boolean) =>
    form.handleSubmit(async (input) => {
      if (!spaceId) return notify.error(new Error('Choose a project'));
      const hours = Number(estimate);
      try {
        const task = await create.mutateAsync({
          listId,
          spaceId,
          body: {
            title: input.title.trim(),
            description: input.description,
            type: input.type,
            priority: input.priority,
            ...(input.statusId && { statusId: input.statusId }),
            assigneeId: (input.assigneeIds && input.assigneeIds[0]) ? input.assigneeIds[0] : (input.assigneeId || null),
            assigneeIds: input.assigneeIds?.length ? input.assigneeIds : (input.assigneeId ? [input.assigneeId] : []),
            startDate: input.startDate ? dayToIso(input.startDate) : null,
            dueDate: input.dueDate ? dayToIso(input.dueDate) : null,
            ...(parent && { parentId: parent.id }),
            ...(estimate && Number.isFinite(hours) && hours >= 0 && { estimateMinutes: Math.round(hours * 60) }),
          },
        });
        notify.success('Task created', { action: { label: 'Open', onClick: () => onCreated?.(task.id) } });
        if (another) {
          form.reset({ ...input, title: '', description: '' });
          form.setFocus('title');
        } else {
          onOpenChange(false);
          onCreated?.(task.id);
        }
      } catch (error) {
        if (!applyServerErrors(error)) throw error;
      }
    })();

  const busy = form.formState.isSubmitting;
  // A bottom sheet on phones: swipe it down to close (F1).
  const swipe = useSwipeDismiss('down', () => onOpenChange(false), isPhone());

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          style={swipe.style}
          {...swipe.handlers}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-2xl border-t bg-popover pb-[env(safe-area-inset-bottom)] text-popover-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-8 sm:inset-x-auto sm:top-[10vh] sm:bottom-auto sm:left-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-[720px] sm:-translate-x-1/2 sm:overflow-visible sm:rounded-xl sm:border sm:pb-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">New task</DialogPrimitive.Title>
          <span aria-hidden className="mx-auto mt-2 block h-1 w-10 rounded-full bg-muted-foreground/30 sm:hidden" />
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit(false);
            }}
          >
            <div className="flex items-center gap-2 px-5 pt-4">
              <OptionPicker
                label="Project"
                placeholder="Search projects"
                width="w-72"
                options={spaces.map((item) => ({ value: item.id, label: item.name, color: item.color }))}
                value={spaceId}
                onChange={(next) => {
                  if (!next) return;
                  setSpaceId(next);
                  // Statuses belong to a project.
                  set('statusId', '');
                }}
                trigger={
                  <button type="button" aria-label={`Project: ${space?.name ?? 'none'}`} className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1 text-sm hover:bg-accent">
                    <span className="flex size-4 items-center justify-center rounded text-[9px] font-bold text-white" style={{ backgroundColor: space?.color ?? '#7b68ee' }}>
                      {space?.name.slice(0, 1).toUpperCase() ?? '?'}
                    </span>
                    {space?.name ?? 'Select a project'}
                  </button>
                }
              />
              {parent ? <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">Subtask of #{parent.number}</span> : null}
              <DialogPrimitive.Close className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
                <XIcon className="size-4" />
              </DialogPrimitive.Close>
            </div>

            <div className="px-5 pt-3 pb-2">
              <input
                autoFocus
                placeholder="Task name"
                aria-label="Task name"
                maxLength={hints('title').maxLength ?? TASK_TITLE_MAX}
                aria-invalid={Boolean(errors.title)}
                className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-muted-foreground/60"
                {...form.register('title')}
              />
              <textarea
                rows={(values.description ?? '').split('\n').length > 3 ? 8 : 3}
                placeholder="Add description"
                aria-label="Description"
                maxLength={TASK_DESCRIPTION_MAX}
                className="mt-2 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                {...form.register('description')}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
              <OptionPicker
                label="Status"
                searchable={false}
                width="w-56"
                options={statuses.map((item) => ({ value: item.id, label: item.name, color: item.color }))}
                value={status?.id}
                onChange={(next) => set('statusId', next ?? '')}
                trigger={
                  <button type="button" className="rounded-[5px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={`Status: ${status?.name ?? 'first status'}`}>
                    <StatusPill status={status ?? { name: 'Status', color: '#6b7280' }} />
                  </button>
                }
              />
              <AssigneePicker
                workspaceId={workspaceId}
                values={values.assigneeIds?.length ? values.assigneeIds : (values.assigneeId ? [values.assigneeId] : [])}
                showName
                onChangeMultiple={(ids) => {
                  set('assigneeIds', ids);
                  set('assigneeId', ids[0] ?? '');
                }}
              />
              <span className={cn(chip, 'px-1')}>
                <DateRangeField
                  className="px-1 py-0 text-xs"
                  placeholder="Dates"
                  start={(values.startDate as Day) || null}
                  due={(values.dueDate as Day) || null}
                  onChange={({ start, due }) => {
                    set('startDate', start ?? '');
                    set('dueDate', due ?? '');
                  }}
                />
              </span>
              <OptionPicker
                label="Priority"
                searchable={false}
                width="w-44"
                options={TASK_PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_META[priority].label, icon: <PriorityIcon priority={priority} className="size-3.5" /> }))}
                value={values.priority}
                onChange={(next) => set('priority', next ?? 'none')}
                trigger={
                  <button type="button" className={cn(chip, values.priority !== 'none' && 'text-foreground')} aria-label={`Priority: ${PRIORITY_META[values.priority ?? 'none'].label}`}>
                    {values.priority && values.priority !== 'none' ? (
                      <>
                        <PriorityIcon priority={values.priority} className="size-3.5" />
                        {PRIORITY_META[values.priority].label}
                      </>
                    ) : (
                      <>
                        <FlagIcon className="size-3.5" /> Priority
                      </>
                    )}
                  </button>
                }
              />
              <OptionPicker
                label="Type"
                searchable={false}
                width="w-44"
                options={TASK_TYPES.map((type) => ({ value: type, label: TYPE_META[type].label }))}
                value={values.type}
                onChange={(next) => set('type', next ?? 'task')}
                trigger={
                  <button type="button" className={cn(chip, values.type !== 'task' && 'text-foreground')} aria-label={`Type: ${TYPE_META[values.type ?? 'task'].label}`}>
                    <TagIcon className="size-3.5" />
                    {values.type === 'task' ? 'Type' : TYPE_META[values.type ?? 'task'].label}
                  </button>
                }
              />
              <button type="button" className={chip} onClick={() => setMore((value) => !value)} aria-expanded={more}>
                {more ? 'Fewer fields' : 'More fields'}
              </button>
            </div>

            {more ? (
              <div className="grid grid-cols-2 gap-3 border-t px-5 py-3 text-sm">
                <label className="text-xs text-muted-foreground">
                  Time estimate (hours)
                  <input
                    value={estimate}
                    onChange={(event) => setEstimate(event.target.value.replace(/[^\d.]/g, '').slice(0, 6))}
                    inputMode="decimal"
                    className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
              {firstError ? (
                <p role="alert" className="mr-auto text-sm text-destructive">
                  {firstError}
                </p>
              ) : null}
              <button type="button" disabled={busy || !spaceId} onClick={() => void submit(true)} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
                Create and add another
              </button>
              <button type="submit" disabled={busy || !spaceId} className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {busy ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
                Create Task
              </button>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
