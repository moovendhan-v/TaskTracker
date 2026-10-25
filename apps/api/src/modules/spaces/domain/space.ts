import type { CustomFieldValues, SpaceStatus } from '@taskflow/shared-types';

export interface Space {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  /** Project health. */
  status: SpaceStatus;
  statusNote: string;
  /** yyyy-mm-dd */
  startDate: string | null;
  dueDate: string | null;
  customFields: CustomFieldValues;
  createdAt: Date;
  updatedAt: Date;
}

export type NewSpace = Pick<Space, 'workspaceId' | 'name' | 'color'>;

export const DEFAULT_SPACE_COLOR = '#0ea5e9';
export const SPACE_STATUS_NOTE_MAX = 500;
