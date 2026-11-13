export interface ChecklistItemRecord {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  doneAt: Date | null;
  doneByName: string | null;
  position: number;
  createdAt: Date;
}

/** A task's checklist. Runs under row-level security: a task you can't see has no steps for you. */
export abstract class ChecklistRepository {
  /** The task's space, or null when there's no such task you can see. */
  abstract taskSpace(workspaceId: string, taskId: string): Promise<string | null>;
  abstract list(workspaceId: string, taskId: string): Promise<ChecklistItemRecord[]>;
  abstract find(workspaceId: string, id: string): Promise<ChecklistItemRecord | null>;
  abstract count(workspaceId: string, taskId: string): Promise<number>;
  abstract insert(input: { workspaceId: string; taskId: string; title: string; position: number; createdBy: string }): Promise<ChecklistItemRecord>;
  abstract update(workspaceId: string, id: string, changes: { title?: string; done?: { by: string } | false; position?: number }): Promise<ChecklistItemRecord | null>;
  abstract delete(workspaceId: string, id: string): Promise<boolean>;
}
