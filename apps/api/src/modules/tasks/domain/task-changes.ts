import type { Task } from './task.js';

/** One readable change for the activity history: "Status: To do → Done". */
export interface TaskChange {
  field: string;
  from: string | null;
  to: string | null;
}

type Names = {
  status: (id: string) => string;
  user: (id: string | null) => string | null;
};

const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);
const text = (value: unknown) => (value === null || value === undefined || value === '' ? null : String(value).slice(0, 300));

/**
 * What changed between two versions of a task, in words people read. Metadata
 * and custom fields are summarised by key so values stay out of the history.
 */
export function describeChanges(before: Task, after: Task, names: Names): TaskChange[] {
  const changes: TaskChange[] = [];
  const add = (field: string, from: string | null, to: string | null) => {
    if (from !== to) changes.push({ field, from, to });
  };
  add('title', text(before.title), text(after.title));
  if (before.description !== after.description) changes.push({ field: 'description', from: null, to: null });
  add('status', names.status(before.statusId), names.status(after.statusId));
  add('priority', before.priority, after.priority);
  add('type', before.type, after.type);
  const beforeAssignees = (before.assigneeIds?.length ? before.assigneeIds : (before.assigneeId ? [before.assigneeId] : [])).map(names.user).filter(Boolean).join(', ') || null;
  const afterAssignees = (after.assigneeIds?.length ? after.assigneeIds : (after.assigneeId ? [after.assigneeId] : [])).map(names.user).filter(Boolean).join(', ') || null;
  add('assignee', beforeAssignees, afterAssignees);
  add('start date', day(before.startDate), day(after.startDate));
  add('due date', day(before.dueDate), day(after.dueDate));
  add('estimate', text(before.estimateMinutes), text(after.estimateMinutes));
  add('progress', text(before.progress), text(after.progress));
  add('sprint', before.sprintId ? 'planned' : null, after.sprintId ? 'planned' : null);
  const changedKeys = (a: object, b: object) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((key) => JSON.stringify((a as never)[key]) !== JSON.stringify((b as never)[key]));
  const metadataKeys = changedKeys(before.metadata, after.metadata);
  if (metadataKeys.length) changes.push({ field: 'metadata', from: null, to: metadataKeys.join(', ').slice(0, 300) });
  if (changedKeys(before.customFields, after.customFields).length) changes.push({ field: 'custom fields', from: null, to: null });
  return changes;
}
