import { useState } from 'react';
import { TASK_PRIORITIES, TASK_TYPES, type TaskPriority, type TaskType } from '@taskflow/shared-types';
import { Modal } from '@/components/kit/modal';
import { notify } from '@/components/kit/notify';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useServerForm } from '@/core/forms/use-server-form';
import { fromDateInputValue } from '@/lib/dates';
import { useLists } from '@/modules/lists';
import { useMembers } from '@/modules/members';
import { useSpaces } from '@/modules/spaces';
import { useStatuses } from '../hooks/use-tasks';
import { useTaskMutations } from '../hooks/use-task-mutations';
import { PRIORITY_META, TYPE_META } from '../lib/task-meta';

interface Values {
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  statusId: string;
  assigneeId: string;
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
  onCreated?: (taskId: string) => void;
}

const select = 'h-9 w-full rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Creates a task anywhere: pick the list, then the rest. Checks the input with
 * the API's own `task.create` rules and shows the API's messages if it refuses.
 */
export function NewTaskDialog({ workspaceId, open, onOpenChange, listId: initialList, spaceId: initialSpace, onCreated }: NewTaskDialogProps) {
  const { data: lists = [] } = useLists(workspaceId);
  const { data: spaces = [] } = useSpaces(workspaceId);
  const { data: members = [] } = useMembers(workspaceId);
  const [chosenList, setListId] = useState<string | null>(initialList ?? null);
  // Until a list is picked, the first one in the given project (lists may still be loading).
  const listId = chosenList ?? lists.find((item) => !initialSpace || item.spaceId === initialSpace)?.id ?? '';
  const list = lists.find((item) => item.id === listId);
  const { data: statuses = [] } = useStatuses(workspaceId, list?.spaceId);
  const { create } = useTaskMutations(workspaceId);
  // Mounted fresh for each use, so defaults are set once here.
  const { form, applyServerErrors } = useServerForm<Values>('task.create', {
    defaultValues: { title: '', description: '', type: 'task', priority: 'normal', statusId: '', assigneeId: '', startDate: '', dueDate: '' },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    if (!listId) return;
    try {
      const task = await create.mutateAsync({
        listId,
        body: {
          title: values.title.trim(),
          description: values.description,
          type: values.type,
          priority: values.priority,
          ...(values.statusId && { statusId: values.statusId }),
          assigneeId: values.assigneeId || null,
          startDate: fromDateInputValue(values.startDate),
          dueDate: fromDateInputValue(values.dueDate),
        },
      });
      notify.success(`Created #${task.number}`);
      onOpenChange(false);
      onCreated?.(task.id);
    } catch (error) {
      if (!applyServerErrors(error)) throw error;
    }
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="New task"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="new-task-form" disabled={form.formState.isSubmitting || !listId}>
            Create task
          </Button>
        </>
      }
    >
      <form id="new-task-form" onSubmit={submit} noValidate className="grid gap-4 p-5">
        <FormField id="new-task-title" label="Name" error={errors.title?.message}>
          <Input id="new-task-title" autoFocus placeholder="What needs doing?" {...form.register('title')} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id="new-task-list" label="List">
            <select id="new-task-list" value={listId} onChange={(event) => setListId(event.target.value)} className={select}>
              <option value="" disabled>
                Choose a list
              </option>
              {spaces.map((space) => (
                <optgroup key={space.id} label={space.name}>
                  {lists
                    .filter((item) => item.spaceId === space.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </FormField>
          <FormField id="new-task-status" label="Status" error={errors.statusId?.message}>
            <select id="new-task-status" className={select} {...form.register('statusId')}>
              <option value="">First status</option>
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="new-task-type" label="Type">
            <select id="new-task-type" className={select} {...form.register('type')}>
              {TASK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_META[type].label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="new-task-priority" label="Priority">
            <select id="new-task-priority" className={select} {...form.register('priority')}>
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_META[priority].label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="new-task-assignee" label="Assignee" error={errors.assigneeId?.message}>
            <select id="new-task-assignee" className={select} {...form.register('assigneeId')}>
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField id="new-task-start" label="Start" error={errors.startDate?.message}>
              <Input id="new-task-start" type="date" {...form.register('startDate')} />
            </FormField>
            <FormField id="new-task-due" label="Due" error={errors.dueDate?.message}>
              <Input id="new-task-due" type="date" {...form.register('dueDate')} />
            </FormField>
          </div>
        </div>
        <FormField id="new-task-description" label="Description" error={errors.description?.message}>
          <Textarea id="new-task-description" rows={3} {...form.register('description')} />
        </FormField>
      </form>
    </Modal>
  );
}
