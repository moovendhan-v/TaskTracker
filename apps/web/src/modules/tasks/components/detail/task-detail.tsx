import {
  CheckIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  GitBranchIcon,
  HistoryIcon,
  LinkIcon,
  MessageSquareIcon,
  MessagesSquareIcon,
  MoreHorizontalIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  isClosedCategory,
  STORY_POINT_SCALE,
  STORY_POINTS_MAX,
  TASK_DESCRIPTION_MAX,
  TASK_RELATION_KINDS,
  TASK_TITLE_MAX,
  TASK_TYPES,
  type Permission,
  type TaskRelationKind,
  type TaskResponse,
  type UpdateTaskRequest,
} from '@taskflow/shared-types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { UserAvatar } from '@/components/common/user-avatar';
import { Modal } from '@/components/kit/modal';
import { Section } from '@/components/kit/section';
import { PullRequestsSection } from '@/modules/integrations';
import { TaskAttachments } from './task-attachments';
import { TaskChecklist } from './task-checklist';
import { TaskStepper } from './task-stepper';
import { DateRangeField } from '@/components/kit/range-calendar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/core/auth/use-current-user';
import { usePreferences } from '@/core/preferences/use-preferences';
import { cn } from '@/lib/cn';
import { dayOf, dayToIso } from '@/lib/days';
import { formatNumericDate } from '@/lib/periods';
import { useResettableState } from '@/lib/use-resettable-state';
import { CommentThread, useComments } from '@/modules/comments';
import { useMemberName } from '@/modules/members';
import { useSpaces } from '@/modules/spaces';
import { TaskTimeControls } from '@/modules/time';
import { usePermissions } from '@/modules/workspaces';
import { TaskChat, useTaskChat } from './task-chat';
import { useSubtasks, useTask, useTaskActivity, useTaskRelations, useTaskWatchers } from '../../hooks/use-tasks';
import { useTaskMutations } from '../../hooks/use-task-mutations';
import { parseStoryPoints, TYPE_META } from '../../lib/task-meta';
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

/** The open task (v2 Features #14a): content and activity on the left, properties and people on the right. */
export function TaskDetail({ workspaceId, taskId, onClose, onOpen }: TaskDetailProps) {
  const { data: task, isLoading } = useTask(workspaceId, taskId);
  const { taskDetailMode } = usePreferences();
  const { data: spaces = [] } = useSpaces(workspaceId);
  const open = Boolean(taskId);
  const space = spaces.find((item) => item.id === task?.spaceId);
  const { data: parent } = useTask(workspaceId, task?.parentId ?? undefined);

  const breadcrumb = task ? (
    <>
      <span className="text-muted-foreground">{space?.name ?? 'Project'}</span>
      {parent ? (
        <>
          <span aria-hidden className="text-subtle-foreground">/</span>
          <button type="button" className="max-w-64 truncate text-muted-foreground hover:text-primary" onClick={() => onOpen(parent.id)}>
            {parent.title}
          </button>
        </>
      ) : null}
      <span aria-hidden className="text-subtle-foreground">/</span>
      <CopyId task={task} />
      <TaskStepper taskId={task.id} onOpen={onOpen} />
    </>
  ) : null;

  if (taskDetailMode === 'side') {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetTitle className="sr-only">{task?.title ?? 'Task'}</SheetTitle>
          <SheetDescription className="sr-only">Task details</SheetDescription>
          {isLoading || !task ? (
            <FullPageSpinner />
          ) : (
            <div key={task.id}>
              <div className="flex items-center gap-2 px-6 pt-5 text-xs">{breadcrumb}</div>
              <TaskMain
                workspaceId={workspaceId}
                task={task}
                onOpen={onOpen}
                onDeleted={onClose}
                // The panel is narrow: properties go right under the title instead of in a side column.
                properties={
                  <div className="-mx-8 -mb-7 border-t bg-muted/20 [&>div]:px-8">
                    <TaskProperties workspaceId={workspaceId} task={task} />
                  </div>
                }
              />
            </div>
          )}
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
      eyebrow={breadcrumb}
      aside={task ? <TaskProperties key={task.id} workspaceId={workspaceId} task={task} /> : null}
    >
      {isLoading || !task ? <FullPageSpinner /> : <TaskMain key={task.id} workspaceId={workspaceId} task={task} onOpen={onOpen} onDeleted={onClose} />}
    </Modal>
  );
}

/** The task's number in mono; clicking copies a link to the task. */
function CopyId({ task }: { task: TaskResponse }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const url = `${window.location.origin}/w/${window.location.pathname.split('/')[2]}/t/${task.id}`;
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button type="button" onClick={copy} title="Copy link to this task" className="inline-flex items-center gap-1 rounded px-1 font-mono text-[11.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
      #{task.number}
      {copied ? <CheckIcon className="size-3 text-good" aria-label="Link copied" /> : <CopyIcon className="size-3 opacity-60" aria-hidden />}
    </button>
  );
}

/** Mono, uppercase section label (v2 type scale). */
function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('font-mono text-[10.5px] font-semibold tracking-[0.06em] text-subtle-foreground uppercase', className)}>{children}</h3>;
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="flex min-h-9 items-center text-[12.5px] text-muted-foreground">{label}</dt>
      <dd className="flex min-h-9 min-w-0 items-center text-[13px]">{children}</dd>
    </div>
  );
}

const inputClass = 'h-8 rounded-md bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none';

/** Right-hand panel: the task's properties, then the people on it. */
function TaskProperties({ workspaceId, task }: { workspaceId: string; task: TaskResponse }) {
  const { update } = useTaskMutations(workspaceId);
  const { canIn } = usePermissions(workspaceId);
  const can = (permission: Permission) => canIn(task.spaceId, permission);
  const canEdit = can('task.update');
  const memberName = useMemberName(workspaceId);
  const [estimate, setEstimate] = useResettableState(task.estimateMinutes === null ? '' : String(task.estimateMinutes / 60));
  const [progress, setProgress] = useResettableState(task.progress === null ? '' : String(task.progress));
  const [points, setPoints] = useResettableState(task.storyPoints === null ? '' : String(task.storyPoints));
  const save = (body: UpdateTaskRequest) => update.mutate({ taskId: task.id, body });
  const creator = memberName(task.createdById) ?? 'Someone';

  return (
    <div className="grid content-start gap-5 overflow-y-auto px-5 py-5">
      <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3">
        <Property label="Status">
          <StatusPicker variant="pill" workspaceId={workspaceId} value={task.status} disabled={!canEdit} onChange={(status) => update.mutate({ taskId: task.id, body: { statusId: status.id }, status })} />
        </Property>
        <Property label="Priority">
          <PriorityPicker showLabel value={task.priority} disabled={!canEdit} onChange={(priority) => save({ priority })} />
        </Property>
        <Property label="Dates">
          <DateRangeField
            start={dayOf(task.startDate)}
            due={dayOf(task.dueDate)}
            closed={isClosedCategory(task.status.category)}
            disabled={!canEdit}
            onChange={({ start, due }) => save({ startDate: start ? dayToIso(start) : null, dueDate: due ? dayToIso(due) : null })}
          />
        </Property>
        <Property label="Estimate">
          <span className="flex items-center gap-1.5">
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
              className={cn(inputClass, 'w-16 font-mono')}
            />
            <span className="text-muted-foreground">h</span>
          </span>
        </Property>
        <Property label="Points">
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={STORY_POINTS_MAX}
              step={1}
              list="story-point-scale"
              value={points}
              disabled={!canEdit}
              placeholder="Empty"
              aria-label="Story points"
              onChange={(event) => setPoints(event.target.value)}
              onBlur={() => {
                const next = parseStoryPoints(points);
                if (next !== task.storyPoints) save({ storyPoints: next });
                setPoints(next === null ? '' : String(next));
              }}
              className={cn(inputClass, 'w-16 font-mono')}
            />
            <datalist id="story-point-scale">
              {STORY_POINT_SCALE.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <span className="text-muted-foreground">pts</span>
          </span>
        </Property>
        <Property label="Complete">
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
              className={cn(inputClass, 'w-14 font-mono')}
            />
            <span className="text-muted-foreground">%</span>
            <span role="meter" aria-label="Percent complete" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(progress) || 0} className="h-1 w-14 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-good" style={{ width: `${Math.max(0, Math.min(100, Number(progress) || 0))}%` }} />
            </span>
          </span>
        </Property>
        <Property label="Created">
          <span className="font-mono text-xs text-muted-foreground">{formatNumericDate(task.createdAt)}</span>
        </Property>
      </dl>

      <div className="grid gap-2 border-t pt-4">
        <Label>People</Label>
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3">
          <Property label="Assignees">
            <AssigneePicker
              showName
              workspaceId={workspaceId}
              values={task.assigneeIds?.length ? task.assigneeIds : (task.assigneeId ? [task.assigneeId] : [])}
              disabled={!can('task.assign')}
              onChangeMultiple={(assigneeIds) => save({ assigneeIds })}
            />
          </Property>
          <Property label="Reporter">
            <span className="flex items-center gap-2">
              <UserAvatar name={creator} className="size-5 text-[9px]" />
              {creator}
            </span>
          </Property>
          <Property label="Watchers">
            <Watchers workspaceId={workspaceId} taskId={task.id} />
          </Property>
        </dl>
      </div>
    </div>
  );
}

/** The left column: header, title, description, subtasks, relations, development and activity. */
function TaskMain({
  workspaceId,
  task,
  onOpen,
  onDeleted,
  properties,
}: {
  workspaceId: string;
  task: TaskResponse;
  onOpen: (taskId: string) => void;
  onDeleted: () => void;
  /** Shown after the description when there's no side column for them. */
  properties?: ReactNode;
}) {
  const { update, remove } = useTaskMutations(workspaceId);
  const { canIn } = usePermissions(workspaceId);
  const can = (permission: Permission) => canIn(task.spaceId, permission);
  const canEdit = can('task.update');
  const [title, setTitle] = useResettableState(task.title);
  const [description, setDescription] = useResettableState(task.description);
  const [editingDescription, setEditingDescription] = useState(false);
  const save = (body: UpdateTaskRequest) => update.mutate({ taskId: task.id, body });

  return (
    <div className="grid gap-7 px-8 py-6">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger disabled={!canEdit} className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={`Type: ${TYPE_META[task.type].label}`}>
              <TypeBadge type={task.type} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {TASK_TYPES.map((type) => (
                <DropdownMenuItem key={type} onSelect={() => save({ type })}>
                  <TypeBadge type={type} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <StatusPicker variant="pill" workspaceId={workspaceId} value={task.status} disabled={!canEdit} onChange={(status) => update.mutate({ taskId: task.id, body: { statusId: status.id }, status })} />
          <div className="flex-1" />
          <TaskTimeControls workspaceId={workspaceId} task={{ id: task.id, number: task.number, title: task.title, spaceId: task.spaceId }} />
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
        <textarea
          value={title}
          maxLength={TASK_TITLE_MAX}
          disabled={!canEdit}
          rows={1}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => title.trim() && title.trim() !== task.title && save({ title: title.trim() })}
          onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), event.currentTarget.blur())}
          aria-label="Task title"
          className="field-sizing-content min-w-0 resize-none rounded-md bg-transparent px-1 text-[30px] leading-tight font-semibold tracking-[-0.025em] outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
        />
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
            className="rounded-md px-1 py-1 text-left text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground hover:bg-muted/40 disabled:hover:bg-transparent"
            aria-label="Description"
          >
            {task.description ? <span className="text-foreground/90">{task.description}</span> : 'Add a description…'}
          </button>
        )}
      </div>

      {properties}
      <Subtasks workspaceId={workspaceId} task={task} onOpen={onOpen} />
      <Relations workspaceId={workspaceId} task={task} onOpen={onOpen} />
      <TaskChecklist workspaceId={workspaceId} task={task} />
      <TaskAttachments workspaceId={workspaceId} task={task} />
      <PullRequestsSection workspaceId={workspaceId} taskId={task.id} canEdit={canEdit} />
      <ActivityTabs workspaceId={workspaceId} task={task} />
    </div>
  );
}

/** Comments, the change history and where it came up in chat, as tabs (design: Activity / Comments / History). */
function ActivityTabs({ workspaceId, task }: { workspaceId: string; task: TaskResponse }) {
  const { data: activity = [] } = useTaskActivity(workspaceId, task.id);
  const { data: comments = [] } = useComments(workspaceId, task.id);
  const { can } = usePermissions(workspaceId);
  const chatAllowed = can('chat.use');
  const { data: chat = [] } = useTaskChat(workspaceId, task.id, chatAllowed);
  return (
    <Tabs defaultValue="comments" className="grid gap-3 border-t pt-5">
      <TabsList className="h-auto w-fit justify-start gap-1 bg-transparent p-0">
        <TabsTrigger value="comments" className="h-8 rounded-md px-2.5 data-[state=active]:bg-selected data-[state=active]:shadow-none">
          <MessageSquareIcon /> Comments <span className="font-mono text-[11px] text-subtle-foreground">{comments.length}</span>
        </TabsTrigger>
        <TabsTrigger value="history" className="h-8 rounded-md px-2.5 data-[state=active]:bg-selected data-[state=active]:shadow-none">
          <HistoryIcon /> History <span className="font-mono text-[11px] text-subtle-foreground">{activity.length}</span>
        </TabsTrigger>
        {chatAllowed ? (
          <TabsTrigger value="chat" className="h-8 rounded-md px-2.5 data-[state=active]:bg-selected data-[state=active]:shadow-none">
            <MessagesSquareIcon /> Chat <span className="font-mono text-[11px] text-subtle-foreground">{chat.length}</span>
          </TabsTrigger>
        ) : null}
      </TabsList>
      <TabsContent value="comments">
        <CommentThread heading={false} workspaceId={workspaceId} taskId={task.id} spaceId={task.spaceId} />
      </TabsContent>
      <TabsContent value="history">
        <History activity={activity} />
      </TabsContent>
      {chatAllowed ? (
        <TabsContent value="chat">
          <TaskChat workspaceId={workspaceId} taskId={task.id} number={task.number} />
        </TabsContent>
      ) : null}
    </Tabs>
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
  const { canIn } = usePermissions(workspaceId);
  const can = (permission: Permission) => canIn(task.spaceId, permission);
  const memberName = useMemberName(workspaceId);
  const [title, setTitle] = useState('');
  const done = subtasks.filter((item) => isClosedCategory(item.status.category)).length;

  return (
    <Section
      variant="plain"
      storageKey="task-detail:subtasks"
      className="border-t pt-4"
      title={
        <span className="flex items-center gap-2 text-sm font-semibold">
          <GitBranchIcon className="size-4 text-muted-foreground" /> Subtasks
        </span>
      }
      actions={
        subtasks.length ? (
          <span className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-subtle-foreground">
              {done}/{subtasks.length}
            </span>
            <span role="meter" aria-label="Subtasks done" aria-valuemin={0} aria-valuemax={subtasks.length} aria-valuenow={done} className="h-1 w-20 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-status-done" style={{ width: `${(done / subtasks.length) * 100}%` }} />
            </span>
          </span>
        ) : null
      }
    >
      <ul className="grid gap-0.5 pt-1">
        {subtasks.map((subtask) => (
          <li key={subtask.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
            <StatusPicker variant="ring" workspaceId={workspaceId} value={subtask.status} disabled={!can('task.update')} onChange={(status) => update.mutate({ taskId: subtask.id, body: { statusId: status.id }, status })} />
            <span className="font-mono text-[11.5px] text-subtle-foreground">#{subtask.number}</span>
            <button type="button" className={cn('min-w-0 flex-1 truncate text-left text-sm hover:text-primary', isClosedCategory(subtask.status.category) && 'text-muted-foreground line-through')} onClick={() => onOpen(subtask.id)}>
              {subtask.title}
            </button>
            {(() => {
              const ids: string[] = subtask.assigneeIds?.length ? subtask.assigneeIds : (subtask.assigneeId ? [subtask.assigneeId] : []);
              if (ids.length > 1) {
                return (
                  <div className="flex -space-x-1.5 items-center">
                    {ids.slice(0, 2).map((id: string) => (
                      <UserAvatar key={id} name={memberName(id) ?? 'Member'} className="size-5 ring-1 ring-background text-[9px]" showTooltip />
                    ))}
                    {ids.length > 2 && (
                      <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[8px] font-semibold ring-1 ring-background">
                        +{ids.length - 2}
                      </span>
                    )}
                  </div>
                );
              }
              if (ids[0]) return <UserAvatar name={memberName(ids[0]) ?? 'Member'} className="size-5 text-[9px]" showTooltip />;
              return null;
            })()}
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
  const { canIn } = usePermissions(workspaceId);
  const can = (permission: Permission) => canIn(task.spaceId, permission);
  const [kind, setKind] = useState<TaskRelationKind>('relates');
  const [number, setNumber] = useState('');

  return (
    <Section
      storageKey="task-detail:relations"
      className="border-t pt-4"
      title={
        <span className="flex items-center gap-2 text-sm font-semibold">
          <LinkIcon className="size-4 text-muted-foreground" /> Relations
        </span>
      }
      count={relations.length}
    >
      <ul className="grid gap-0.5 pt-1">
        {relations.map((relation) => (
          <li key={relation.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">{KIND_LABEL[relation.kind][relation.outgoing ? 'outgoing' : 'incoming']}</span>
            <StatusDot status={relation.task.status} />
            <span className="font-mono text-[11.5px] text-subtle-foreground">#{relation.task.number}</span>
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

function History({ activity }: { activity: readonly { id: string; actorName: string | null; field: string | null; from: string | null; to: string | null; kind: string; createdAt: string }[] }) {
  return (
    <ol className="grid gap-2.5 text-sm">
      {activity.map((item) => (
        <li key={item.id} className="flex gap-2.5">
          <UserAvatar name={item.actorName ?? '?'} className="mt-0.5 size-5 shrink-0 text-[9px]" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{item.actorName ?? 'Someone'}</span>{' '}
            {item.field ? (
              <>
                changed {item.field}
                {item.from ? <> from <span className="text-foreground">{item.from}</span></> : null} to <span className="text-foreground">{item.to ?? 'nothing'}</span>
              </>
            ) : (
              item.kind.replace(/_/g, ' ')
            )}{' '}
            <span className="font-mono text-[11px] text-subtle-foreground">· {ago(item.createdAt)}</span>
          </span>
        </li>
      ))}
      {activity.length === 0 ? <li className="text-muted-foreground">No changes yet.</li> : null}
    </ol>
  );
}
