import type { TaskRelationKind } from '@taskflow/shared-types';

export interface TaskRelation {
  id: string;
  workspaceId: string;
  taskId: string;
  relatedTaskId: string;
  kind: TaskRelationKind;
  createdById: string | null;
  createdAt: Date;
}

export interface TaskActivity {
  id: string;
  workspaceId: string;
  taskId: string;
  actorId: string | null;
  actorName: string | null;
  kind: string;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  createdAt: Date;
}

export type NewTaskActivity = Omit<TaskActivity, 'id' | 'actorName' | 'createdAt'>;
