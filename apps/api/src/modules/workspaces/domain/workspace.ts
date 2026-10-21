export interface Workspace {
  id: string;
  name: string;
  color: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewWorkspace = Pick<Workspace, 'name' | 'color' | 'ownerId'>;

export const DEFAULT_WORKSPACE_COLOR = '#6366f1';
