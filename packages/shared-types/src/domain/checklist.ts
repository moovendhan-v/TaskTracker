/** Steps on one task, at most. */
export const TASK_CHECKLIST_MAX = 100;
export const CHECKLIST_TITLE_MAX = 300;

/** One step of a task's checklist (C2). */
export interface ChecklistItemResponse {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  doneAt: string | null;
  doneByName: string | null;
  /** Order on the task; lower comes first. */
  position: number;
  createdAt: string;
}

/** How far a checklist is, e.g. 3 of 5. */
export function checklistProgress(items: readonly Pick<ChecklistItemResponse, 'done'>[]): { done: number; total: number } {
  return { done: items.filter((item) => item.done).length, total: items.length };
}
