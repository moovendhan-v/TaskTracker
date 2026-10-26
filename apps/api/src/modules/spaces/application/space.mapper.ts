import type { SpaceResponse } from '@taskflow/shared-types';
import type { Space } from '../domain/space.js';

export const SpaceMapper = {
  toResponse(space: Space): SpaceResponse {
    return {
      id: space.id,
      workspaceId: space.workspaceId,
      name: space.name,
      color: space.color,
      status: space.status,
      statusNote: space.statusNote,
      startDate: space.startDate,
      dueDate: space.dueDate,
      customFields: space.customFields ?? {},
      createdAt: space.createdAt.toISOString(),
    };
  },
};
