import type { StatusCategory } from '@taskflow/shared-types';

export interface TaskStatus {
  id: string;
  workspaceId: string;
  spaceId: string;
  name: string;
  color: string;
  category: StatusCategory;
  position: number;
  wipLimit: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewTaskStatus = Pick<TaskStatus, 'workspaceId' | 'spaceId' | 'name' | 'color' | 'category' | 'position'> & Partial<Pick<TaskStatus, 'wipLimit'>>;
