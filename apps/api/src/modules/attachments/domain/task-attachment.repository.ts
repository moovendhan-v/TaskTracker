export interface TaskAttachmentRecord {
  id: string;
  taskId: string;
  uploaderId: string | null;
  uploaderName: string | null;
  fileName: string;
  contentType: string | null;
  declaredSize: number;
  size: number | null;
  storageKey: string;
  status: 'pending' | 'ready';
  createdAt: Date;
}

/** Task files. Runs under row-level security: a task you can't see has no files for you. */
export abstract class TaskAttachmentRepository {
  /** The task's space, when the caller can see the task. */
  abstract taskSpace(workspaceId: string, taskId: string): Promise<string | null>;
  abstract list(workspaceId: string, taskId: string): Promise<TaskAttachmentRecord[]>;
  abstract find(workspaceId: string, id: string): Promise<TaskAttachmentRecord | null>;
  abstract countOnTask(workspaceId: string, taskId: string): Promise<number>;
  abstract countPending(workspaceId: string, uploaderId: string): Promise<number>;
  abstract stale(workspaceId: string, uploaderId: string, before: Date): Promise<TaskAttachmentRecord[]>;
  abstract insert(input: { workspaceId: string; taskId: string; uploaderId: string; fileName: string; declaredSize: number; storageKey: string }): Promise<string>;
  abstract markReady(workspaceId: string, id: string, contentType: string, size: number): Promise<boolean>;
  abstract remove(workspaceId: string, id: string): Promise<boolean>;
}
