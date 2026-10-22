export interface Workspace {
  id: string;
  name: string;
  color: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** The id is chosen up front so the new workspace's rows can be written in its own row-level security scope. */
export type NewWorkspace = Pick<Workspace, 'id' | 'name' | 'color' | 'ownerId'>;

export const DEFAULT_WORKSPACE_COLOR = '#6366f1';
