import type { CustomFieldValues, StatusCategory, TaskMetadata, TaskPriority, TaskRelationKind, TaskType } from '../domain/task.js';

export interface TaskStatusResponse {
  id: string;
  spaceId: string;
  name: string;
  color: string;
  category: StatusCategory;
  position: number;
}

export interface SaveTaskStatusRequest {
  name: string;
  color: string;
  category: StatusCategory;
}

export interface TaskResponse {
  id: string;
  /** Short number, unique in the workspace: #978. */
  number: number;
  listId: string;
  spaceId: string;
  parentId: string | null;
  type: TaskType;
  title: string;
  description: string;
  statusId: string;
  status: TaskStatusResponse;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  assigneeId: string | null;
  assigneeIds: string[];
  /** Sprint the task is planned into; null when it's in the backlog. */
  sprintId: string | null;
  position: number;
  estimateMinutes: number | null;
  /** 0–100. */
  progress: number | null;
  subtaskCount: number;
  /** Null unless a policy lets the caller read `task.metadata`. */
  metadata: TaskMetadata | null;
  customFields: CustomFieldValues;
  completedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  type?: TaskType;
  statusId?: string;
  priority?: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  assigneeIds?: string[];
  parentId?: string | null;
  estimateMinutes?: number | null;
  metadata?: TaskMetadata;
  customFields?: CustomFieldValues;
}

/** `metadata` and `customFields` are merged into what the task has; a key set to null is removed. */
export interface UpdateTaskRequest extends Partial<Omit<CreateTaskRequest, 'parentId'>> {
  position?: number;
  /** Planning a task into a sprint needs sprint.manage. */
  sprintId?: string | null;
  progress?: number | null;
}

export interface TaskRelationResponse {
  id: string;
  kind: TaskRelationKind;
  /** True when this task is the source: "this task blocks the other". */
  outgoing: boolean;
  task: { id: string; number: number; title: string; status: TaskStatusResponse };
}

export interface TaskActivityResponse {
  id: string;
  taskId: string;
  actorId: string | null;
  actorName: string | null;
  kind: string;
  /** Human-readable change, e.g. { field: 'status', from: 'To do', to: 'Done' }. */
  field: string | null;
  from: string | null;
  to: string | null;
  createdAt: string;
}

export interface TaskAttachmentResponse {
  id: string;
  taskId: string;
  fileName: string;
  contentType: string;
  size: number;
  isImage: boolean;
  /** A short-lived signed link (minutes); read the list again for fresh ones. */
  url: string;
  uploaderId: string | null;
  uploaderName: string | null;
  createdAt: string;
}

export interface TaskUploadTicket {
  attachmentId: string;
  /** PUT the raw file here (same origin), with its Content-Length, within a few minutes. */
  uploadUrl: string;
  maxBytes: number;
}

/** The checked file, or why it was refused (it is deleted then). */
export interface TaskUploadResult {
  attachment: TaskAttachmentResponse | null;
  error: string | null;
}
