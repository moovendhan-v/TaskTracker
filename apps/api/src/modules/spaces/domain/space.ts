export interface Space {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewSpace = Pick<Space, 'workspaceId' | 'name' | 'color'>;

export const DEFAULT_SPACE_COLOR = '#0ea5e9';
