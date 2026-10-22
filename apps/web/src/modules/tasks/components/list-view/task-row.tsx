import type { TaskResponse } from '@taskflow/shared-types';
import { cn } from '@/lib/cn';
import { usePermissions } from '@/modules/workspaces';
import { useTaskMutations } from '../../hooks/use-task-mutations';
import { AssigneePicker } from '../shared/assignee-picker';
import { DueDateLabel } from '../shared/due-date';
import { PriorityPicker } from '../shared/priority-picker';
import { StatusPicker } from '../shared/status-picker';

interface TaskRowProps {
  workspaceId: string;
  task: TaskResponse;
  onOpen: (taskId: string) => void;
}

export function TaskRow({ workspaceId, task, onOpen }: TaskRowProps) {
  const { update } = useTaskMutations(workspaceId);
  const { can } = usePermissions(workspaceId);
  const canEdit = can('task.update');

  return (
    <div className="group grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 border-b px-3 py-1.5 last:border-b-0 hover:bg-muted/50">
      <StatusPicker compact value={task.status} disabled={!canEdit} onChange={(status) => update.mutate({ taskId: task.id, body: { status } })} />
      <button
        type="button"
        onClick={() => onOpen(task.id)}
        className={cn('truncate text-left text-sm hover:text-primary', task.status === 'done' && 'text-muted-foreground line-through')}
      >
        {task.title}
      </button>
      <DueDateLabel dueDate={task.dueDate} done={task.status === 'done'} />
      <PriorityPicker value={task.priority} disabled={!canEdit} onChange={(priority) => update.mutate({ taskId: task.id, body: { priority } })} />
      <AssigneePicker
        workspaceId={workspaceId}
        value={task.assigneeId}
        disabled={!can('task.assign')}
        onChange={(assigneeId) => update.mutate({ taskId: task.id, body: { assigneeId } })}
      />
    </div>
  );
}
