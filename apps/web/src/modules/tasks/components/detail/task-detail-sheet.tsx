import { TrashIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TASK_DESCRIPTION_MAX, TASK_TITLE_MAX, type TaskResponse, type UpdateTaskRequest } from '@taskflow/shared-types';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FullPageSpinner } from '@/components/common/full-page-spinner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { formatLongDate } from '@/lib/dates';
import { CommentThread } from '@/modules/comments';
import { usePermissions } from '@/modules/workspaces';
import { useTask } from '../../hooks/use-tasks';
import { useTaskMutations } from '../../hooks/use-task-mutations';
import { AssigneePicker } from '../shared/assignee-picker';
import { DueDateInput } from '../shared/due-date';
import { PriorityPicker } from '../shared/priority-picker';
import { StatusPicker } from '../shared/status-picker';

interface TaskDetailSheetProps {
  workspaceId: string;
  taskId: string | undefined;
  onClose: () => void;
}

export function TaskDetailSheet({ workspaceId, taskId, onClose }: TaskDetailSheetProps) {
  const { data: task, isLoading } = useTask(workspaceId, taskId);

  return (
    <Sheet open={Boolean(taskId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {isLoading || !task ? (
          <>
            <SheetTitle className="sr-only">Task</SheetTitle>
            <SheetDescription className="sr-only">Loading task details</SheetDescription>
            <FullPageSpinner />
          </>
        ) : (
          <TaskDetail key={task.id} workspaceId={workspaceId} task={task} onDeleted={onClose} />
        )}
      </SheetContent>
    </Sheet>
  );
}

interface TaskDetailProps {
  workspaceId: string;
  task: TaskResponse;
  onDeleted: () => void;
}

function TaskDetail({ workspaceId, task, onDeleted }: TaskDetailProps) {
  const { update, remove } = useTaskMutations(workspaceId);
  const { can } = usePermissions(workspaceId);
  const canEdit = can('task.update');
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);

  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setDescription(task.description), [task.description]);

  const save = (body: UpdateTaskRequest) => update.mutate({ taskId: task.id, body });

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="grid gap-4 p-6 pr-12">
        <SheetDescription className="text-xs">Created {formatLongDate(task.createdAt)}</SheetDescription>
        <SheetTitle asChild>
          <input
            value={title}
            maxLength={TASK_TITLE_MAX}
            disabled={!canEdit}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => title.trim() && title.trim() !== task.title && save({ title: title.trim() })}
            onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
            aria-label="Task title"
            className="w-full rounded-md bg-transparent px-1 text-xl font-semibold outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:hover:bg-transparent"
          />
        </SheetTitle>

        <dl className="grid grid-cols-[7rem_1fr] items-center gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <StatusPicker value={task.status} disabled={!canEdit} onChange={(status) => save({ status })} />
          </dd>
          <dt className="text-muted-foreground">Priority</dt>
          <dd>
            <PriorityPicker showLabel value={task.priority} disabled={!canEdit} onChange={(priority) => save({ priority })} />
          </dd>
          <dt className="text-muted-foreground">Assignee</dt>
          <dd>
            <AssigneePicker
              showName
              workspaceId={workspaceId}
              value={task.assigneeId}
              disabled={!can('task.assign')}
              onChange={(assigneeId) => save({ assigneeId })}
            />
          </dd>
          <dt>
            <label htmlFor="task-due-date" className="text-muted-foreground">
              Due date
            </label>
          </dt>
          <dd>
            <DueDateInput id="task-due-date" value={task.dueDate} disabled={!canEdit} onChange={(dueDate) => save({ dueDate })} />
          </dd>
        </dl>

        <div className="grid gap-1.5">
          <label htmlFor="task-description" className="text-sm font-semibold">
            Description
          </label>
          <Textarea
            id="task-description"
            value={description}
            maxLength={TASK_DESCRIPTION_MAX}
            disabled={!canEdit}
            onChange={(event) => setDescription(event.target.value)}
            onBlur={() => description !== task.description && save({ description })}
            placeholder={canEdit ? 'Add more detail…' : 'No description'}
            rows={6}
          />
        </div>
      </div>

      <Separator />
      <div className="p-6">
        <CommentThread workspaceId={workspaceId} taskId={task.id} />
      </div>

      {can('task.delete') ? (
        <div className="mt-auto border-t p-4">
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <TrashIcon /> Delete task
              </Button>
            }
            title="Delete this task?"
            description="The task and its comments will be removed."
            confirmLabel="Delete task"
            onConfirm={() => remove.mutateAsync(task.id).then(onDeleted)}
          />
        </div>
      ) : null}
    </div>
  );
}
