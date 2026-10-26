import type { SpaceStatus } from '../domain/custom-field.js';
import type { CustomFieldValues } from '../domain/task.js';

export interface SpaceResponse {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  /** Project health: on track, at risk… */
  status: SpaceStatus;
  statusNote: string;
  startDate: string | null;
  dueDate: string | null;
  customFields: CustomFieldValues;
  createdAt: string;
}

export interface CreateSpaceRequest {
  name: string;
  color?: string;
}

export interface UpdateSpaceRequest extends Partial<CreateSpaceRequest> {
  status?: SpaceStatus;
  statusNote?: string;
  startDate?: string | null;
  dueDate?: string | null;
  /** Merged into what the space has; a key set to null is removed. */
  customFields?: CustomFieldValues;
}
