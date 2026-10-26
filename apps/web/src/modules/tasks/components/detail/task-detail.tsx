import {
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  CircleDotIcon,
  EyeIcon,
  EyeOffIcon,
  FlagIcon,
  GitBranchIcon,
  HistoryIcon,
  HourglassIcon,
  LinkIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PercentIcon,
  PlusIcon,
  TrashIcon,
  UserRoundIcon,
  XIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  isClosedCategory,
  TASK_DESCRIPTION_MAX,
  TASK_RELATION_KINDS,
  TASK_TITLE_MAX,
  TASK_TYPES,
  type TaskRelationKind,
  type TaskResponse,
  type UpdateTaskRequest,
} from '@taskflow/shared-types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { UserAvatar } from '@/components/common/user-avatar';
import { Modal } from '@/components/kit/modal';
import { Section } from '@/components/kit/section';
import { DateRangeField } from '@/components/kit/range-calendar';
import { StatusPill } from '@/components/kit/status-pill';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { usePreferences } from '@/core/preferences/use-preferences';
import { cn } from '@/lib/cn';
import { dayOf, dayToIso } from '@/lib/days';
import { formatNumericDate } from '@/lib/periods';
import { useResettableState } from '@/lib/use-resettable-state';
import { CommentThread } from '@/modules/comments';
import { useMemberName } from '@/modules/members';
import { useSpaces } from '@/modules/spaces';
import { TaskTimeControls } from '@/modules/time';
import { usePermissions } from '@/modules/workspaces';
import { useSubtasks, useTask, useTaskActivity, useTaskRelations, useTaskWatchers } from '../../hooks/use-tasks';
import { useTaskMutations } from '../../hooks/use-task-mutations';
import { TYPE_META } from '../../lib/task-meta';
import { AssigneePicker } from '../shared/assignee-picker';
import { PriorityPicker } from '../shared/priority-picker';
import { StatusDot, StatusPicker } from '../shared/status-picker';
import { TypeBadge } from '../shared/type-badge';

interface TaskDetailProps {
  workspaceId: string;
  taskId: string | undefined;
  onClose: () => void;
  onOpen: (taskId: string) => void;
}

/** The open task, as a centred modal or a side panel (the user's preference). */
export function TaskDetail({ workspaceId, taskId, onClose, onOpen }: TaskDetailProps) {
  const { data: task, isLoading } = useTask(workspaceId, taskId);
  const { taskDetailMode } = usePreferences();
  const { data: spaces = [] } = useSpaces(workspaceId);
  const memberName = useMemberName(workspaceId);
  const open = Boolean(taskId);
  const space = spaces.find((item) => item.id === task?.spaceId);
  const { data: parent } = useTask(workspaceId, task?.parentId ?? undefined);

  if (taskDetailMode === 'side') {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetTitle className="sr-only">{task?.title ?? 'Task'}</SheetTitle>
          <SheetDescription className="sr-only">Task details</SheetDescription>
          {isLoading || !task ? <FullPageSpinner /> : <TaskBody key={task.id} workspaceId={workspaceId} task={task} onOpen={onOpen} onDeleted={onClose} />}
          {task ? (
            <div className="border-t p-4">
              <CommentThread workspaceId={workspaceId} taskId={task.id} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      size="wide"
      tall
      hideTitle
      title={task?.title ?? 'Task'}
      eyebrow={
        task ? (
          <>
            <span className="rounded bg-muted px-2 py-0.5 font-medium text-foreground">{space?.name ?? 'Project'}</span>
            {parent ? (
              <>
                <span aria-hidden>/</span>
                <button type="button" className="max-w-64 truncate hover:text-primary" onClick={() => onOpen(parent.id)}>
                  {parent.title}
                </button>
              </>
            ) : null}
            <span className="ml-1 tabular-nums text-muted-foreground/70">#{task.number}</span>
          </>
        ) : null
      }
      headerActions={task ? <span className="hidden text-xs text-muted-foreground sm:inline">Created {formatNumericDate(task.createdAt)} by {memberName(task.createdById) ?? 'someone'}</span> : null}
      aside={
        task ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <h2 className="flex items-center gap-2 border-b px-5 py-3 text-sm font-semibold">
              <MessageSquareIcon className="size-4 text-muted-foreground" /> Activity
            </h2>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <CommentThread workspaceId={workspaceId} taskId={task.id} />
            </div>
          </div>
        ) : null
      }
    >
      {isLoading || !task ? <FullPageSpinner /> : <TaskBody key={task.id} workspaceId={workspaceId} task={task} onOpen={onOpen} onDeleted={onClose} />}
    </Modal>
  );
}

function Property({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-10 grid-cols-[120px_minmax(0,1fr)] items-center gap-2 text-sm">
      <dt className="flex items-center gap-2 text-[13px] text-muted-foreground [&_svg]:size-4">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

const inputClass = 'h-8 rounded-md bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none';

function TaskBody({ workspaceId, task, onOpen, onDeleted }: { workspaceId: string; task: TaskResponse; onOpen: (taskId: string) => void; onDeleted: () => void }) {
  const { update, remove } = useTaskMutations(workspaceId);
  const { can } = usePermissions(workspaceId);
  const canEdit = can('task.update');
  const [title, setTitle] = useResettableState(task.title);
  const [description, setDescription] = useResettableState(task.description);
  const [editingDescription, setEditingDescription] = useState(false);
  const [estimate, setEstimate] = useResettableState(task.estimateMinutes === null ? '' : String(task.estimateMinutes / 60));
  const [progress, setProgress] = useResettableState(task.progress === null ? '' : String(task.progress));
  const save = (body: UpdateTaskRequest) => update.mutate({ taskId: task.id, body });

  return (
    <div className="grid gap-6 px-8 py-6">
      <div className="grid gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger disabled={!canEdit} className="w-fit rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={`Type: ${TYPE_META[task.type].label}`}>
            <span className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-muted">
              <CircleDotIcon className="size-3.5 text-primary" />
              {TYPE_META[task.type].label}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {TASK_TYPES.map((type) => (
              <DropdownMenuItem key={type} onSelect={() => save({ type })}>
                <TypeBadge type={type} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-start gap-2">
          <textarea
            value={title}
            maxLength={TASK_TITLE_MAX}
            disabled={!canEdit}
            rows={1}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => title.trim() && title.trim() !== task.title && save({ title: title.trim() })}
            onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), event.currentTarget.blur())}
            aria-label="Task title"
            className="field-sizing-content min-w-0 flex-1 resize-none rounded-md bg-transparent px-1 text-[28px] leading-tight font-bold outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          />
          {can('task.delete') ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Task actions">
                <MoreHorizontalIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <ConfirmDialog
                  trigger={
                    <DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>
                      <TrashIcon /> Delete task
                    </DropdownMenuItem>
                  }
                  title="Delete this task?"
                  description="The task, its comments and its subtasks' link to it will be removed."
                  confirmLabel="Delete task"
                  onConfirm={() => remove.mutateAsync(task.id).then(onDeleted)}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <dl className="grid gap-x-10 gap-y-0.5 lg:grid-cols-2">
        <div className="grid content-start gap-0.5">
          <Property icon={<CircleDotIcon />} label="Status">
            <StatusPicker variant="pill" workspaceId={workspaceId} value={task.status} disabled={!canEdit} onChange={(status) => update.mutate({ taskId: task.id, body: { statusId: status.id }, status })} />
          </Property>
          <Property icon={<CalendarDaysIcon />} label="Dates">
            <DateRangeField
              start={dayOf(task.startDate)}
              due={dayOf(task.dueDate)}
              closed={isClosedCategory(task.status.category)}
              disabled={!canEdit}
              onChange={({ start, due }) => save({ startDate: start ? dayToIso(start) : null, dueDate: due ? dayToIso(due) : null })}
            />
          </Property>
          <Property icon={<HourglassIcon />} label="Work">
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={0.25}
                value={estimate}
                disabled={!canEdit}
                placeholder="Empty"
                aria-label="Estimate in hours"
                onChange={(event) => setEstimate(event.target.value)}
                onBlur={() => save({ estimateMinutes: estimate === '' ? null : Math.round(Number(estimate) * 60) })}
                className={cn(inputClass, 'w-16')}
              />
              <span className="text-muted-foreground">hours</span>
            </span>
          </Property>
          <Property icon={<ClockIcon />} label="Track time">
            <TaskTimeControls workspaceId={workspaceId} task={{ id: task.id, number: task.number, title: task.title, spaceId: task.spaceId }} />
          </Property>
        </div>
        <div className="grid content-start gap-0.5">
          <Property icon={<UserRoundIcon />} label="Assignee">
            <AssigneePicker showName workspaceId={workspaceId} value={task.assigneeId} disabled={!can('task.assign')} onChange={(assigneeId) => save({ assigneeId })} />
          </Property>
          <Property icon={<FlagIcon />} label="Priority">
            <PriorityPicker showLabel value={task.priority} disabled={!canEdit} onChange={(priority) => save({ priority })} />
          </Property>
          <Property icon={<PercentIcon />} label="% complete">
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={progress}
                disabled={!canEdit}
                placeholder="Empty"
                aria-label="Percent complete"
                onChange={(event) => setProgress(event.target.value)}
                onBlur={() => save({ progress: progress === '' ? null : Math.max(0, Math.min(100, Math.round(Number(progress)))) })}
                className={cn(inputClass, 'w-14')}
              />
              <span className="text-muted-foreground">%</span>
              <span role="meter" aria-label="Percent complete" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(progress) || 0} className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-good" style={{ width: `${Math.max(0, Math.min(100, Number(progress) || 0))}%` }} />
              </span>
            </span>
          </Property>
          <Property icon={<EyeIcon />} label="Watchers">
            <Watchers workspaceId={workspaceId} taskId={task.id} />
          </Property>
        </div>
      </dl>

      <section className="grid gap-2 border-t pt-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Description</h3>
          {canEdit && !editingDescription ? (
            <button type="button" className="text-sm text-primary hover:underline" onClick={() => setEditingDescription(true)}>
              Edit
            </button>
          ) : null}
        </div>
        {editingDescription ? (
          <Textarea
            autoFocus
            value={description}
            maxLength={TASK_DESCRIPTION_MAX}
            rows={6}
            aria-label="Description"
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => {
              setEditingDescription(false);
              if (description !== task.description) save({ description });
            }}
          />
        ) : (
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setEditingDescription(true)}
            className="rounded-md px-1 py-1 text-left text-sm whitespace-pre-wrap hover:bg-muted/40 disabled:hover:bg-transparent"
            aria-label="Description"
          >
            {task.description || <span className="text-muted-foreground">Add a description…</span>}
          </button>
        )}
      </section>

      <Subtasks workspaceId={workspaceId} task={task} onOpen={onOpen} />
      <Relations workspaceId={workspaceId} task={task} onOpen={onOpen} />
      <History workspaceId={workspaceId} taskId={task.id} />
    </div>
  );
}

function Watchers({ workspaceId, taskId }: { workspaceId: string; taskId: string }) {
  const { data: watcherIds = [] } = useTaskWatchers(workspaceId, taskId);
  const { data: me } = useCurrentUser();
  const memberName = useMemberName(workspaceId);
  const { watch } = useTaskMutations(workspaceId);
  const watching = Boolean(me && watcherIds.includes(me.id));
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {watcherIds.map((userId) => {
        const name = memberName(userId) ?? 'Member';
        return (
          <span key={userId} className="inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2 pl-0.5 text-xs">
            <UserAvatar name={name} className="size-5" />
            {name.split(' ')[0]}
          </span>
        );
      })}
      <button type="button" onClick={() => watch.mutate({ taskId, watching: !watching })} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
        {watching ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
        {watching ? 'Stop watching' : 'Watch'}
      </button>
    </span>
  );
}

function Subtasks({ workspaceId, task, onOpen }: { workspaceId: string; task: TaskResponse; onOpen: (taskId: string) => void }) {
  const { data: subtasks = [] } = useSubtasks(workspaceId, task.id);
  const { create, update } = useTaskMutations(workspaceId);
  const { can } = usePermissions(workspaceId);
  const memberName = useMemberName(workspaceId);
  const [title, setTitle] = useState('');
  const done = subtasks.filter((item) => isClosedCategory(item.status.category)).length;

  return (
    <Section
      variant="plain"
      storageKey="task-detail:subtasks"
      className="border-t pt-4"
      title={
        <span className="flex items-center gap-2 font-semibold">
          <GitBranchIcon className="size-4" /> Subtasks
        </span>
      }
      count={subtasks.length}
      actions={subtasks.length ? <span className="text-xs text-muted-foreground">{done} done</span> : null}
    >
      <ul className="grid gap-0.5 pt-1">
        {subtasks.map((subtask) => (
          <li key={subtask.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
            <StatusPicker variant="ring" workspaceId={workspaceId} value={subtask.status} disabled={!can('task.update')} onChange={(status) => update.mutate({ taskId: subtask.id, body: { statusId: status.id }, status })} />
            <span className="text-xs tabular-nums text-muted-foreground">#{subtask.number}</span>
            <button type="button" className={cn('min-w-0 flex-1 truncate text-left text-sm hover:text-primary', isClosedCategory(subtask.status.category) && 'text-muted-foreground line-through')} onClick={() => onOpen(subtask.id)}>
              {subtask.title}
            </button>
            <StatusPill status={subtask.status} size="xs" />
            {subtask.assigneeId ? <UserAvatar name={memberName(subtask.assigneeId) ?? 'Member'} className="size-5 text-[9px]" showTooltip /> : null}
          </li>
        ))}
      </ul>
      {can('task.create') ? (
        <form
          className="flex items-center gap-2 px-2 pt-1"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = title.trim();
            if (trimmed) create.mutate({ listId: task.listId, body: { title: trimmed, parentId: task.id } }, { onSuccess: () => setTitle('') });
          }}
        >
          <PlusIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <input value={title} maxLength={TASK_TITLE_MAX} onChange={(event) => setTitle(event.target.value)} placeholder="Add subtask (Enter)" aria-label="New subtask" className="h-8 w-full rounded-md bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:bg-muted/50" />
        </form>
      ) : null}
    </Section>
  );
}

const KIND_LABEL: Record<TaskRelationKind, { outgoing: string; incoming: string }> = {
  relates: { outgoing: 'Related to', incoming: 'Related to' },
  blocks: { outgoing: 'Blocks', incoming: 'Blocked by' },
  duplicates: { outgoing: 'Duplicates', incoming: 'Duplicated by' },
};

function Relations({ workspaceId, task, onOpen }: { workspaceId: string; task: TaskResponse; onOpen: (taskId: string) => void }) {
  const { data: relations = [] } = useTaskRelations(workspaceId, task.id);
  const { relateByNumber, unrelate } = useTaskMutations(workspaceId);
  const { can } = usePermissions(workspaceId);
  const [kind, setKind] = useState<TaskRelationKind>('relates');
  const [number, setNumber] = useState('');

  return (
    <Section
      storageKey="task-detail:relations"
      className="border-t pt-4"
      title={
        <span className="flex items-center gap-2 font-semibold">
          <LinkIcon className="size-4" /> Relations
        </span>
      }
      count={relations.length}
    >
      <ul className="grid gap-0.5 pt-1">
        {relations.map((relation) => (
          <li key={relation.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">{KIND_LABEL[relation.kind][relation.outgoing ? 'outgoing' : 'incoming']}</span>
            <StatusDot status={relation.task.status} />
            <span className="text-xs tabular-nums text-muted-foreground">#{relation.task.number}</span>
            <button type="button" className="min-w-0 flex-1 truncate text-left hover:text-primary" onClick={() => onOpen(relation.task.id)}>
              {relation.task.title}
            </button>
            {can('task.update') ? (
              <button type="button" className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Remove relation" onClick={() => unrelate.mutate(relation.id)}>
                <XIcon className="size-3.5" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {can('task.update') ? (
        <form
          className="flex items-center gap-2 px-2 pt-1"
          onSubmit={(event) => {
            event.preventDefault();
            const value = Number(number.replace('#', '').trim());
            if (Number.isInteger(value) && value > 0) relateByNumber.mutate({ taskId: task.id, number: value, kind }, { onSuccess: () => setNumber('') });
          }}
        >
          <PlusIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <select value={kind} onChange={(event) => setKind(event.target.value as TaskRelationKind)} aria-label="Relation" className="h-7 rounded-md border bg-background px-1.5 text-xs">
            {TASK_RELATION_KINDS.map((item) => (
              <option key={item} value={item}>
                {KIND_LABEL[item].outgoing}
              </option>
            ))}
          </select>
          <input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" placeholder="Task number, then Enter" aria-label="Related task number" className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:bg-muted/50" />
          {relateByNumber.isPending ? <CheckIcon className="size-4 animate-pulse text-muted-foreground" /> : null}
        </form>
      ) : null}
    </Section>
  );
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
function ago(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return relative.format(-minutes, 'minute');
  if (minutes < 60 * 24) return relative.format(-Math.round(minutes / 60), 'hour');
  return relative.format(-Math.round(minutes / 1440), 'day');
}

function History({ workspaceId, taskId }: { workspaceId: string; taskId: string }) {
  const { data: activity = [] } = useTaskActivity(workspaceId, taskId);
  return (
    <Section
      storageKey="task-detail:history"
      defaultOpen={false}
      className="border-t pt-4"
      title={
        <span className="flex items-center gap-2 font-semibold">
          <HistoryIcon className="size-4" /> History
        </span>
      }
      count={activity.length}
    >
      <ol className="grid gap-2 pt-2 pl-2 text-sm">
        {activity.map((item) => (
          <li key={item.id} className="text-muted-foreground">
            <span className="font-medium text-foreground">{item.actorName ?? 'Someone'}</span>{' '}
            {item.field ? (
              <>
                changed {item.field}
                {item.from ? <> from <span className="text-foreground">{item.from}</span></> : null} to <span className="text-foreground">{item.to ?? 'nothing'}</span>
              </>
            ) : (
              item.kind.replace(/_/g, ' ')
            )}{' '}
            · {ago(item.createdAt)}
          </li>
        ))}
        {activity.length === 0 ? <li className="text-muted-foreground">No changes yet.</li> : null}
      </ol>
    </Section>
  );
}
