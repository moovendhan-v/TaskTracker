import type { SpaceResponse } from '@taskflow/shared-types';
import type { Space } from '../domain/space.js';

export const SpaceMapper = {
  toResponse(space: Space): SpaceResponse {
    return {
      id: space.id,
      workspaceId: space.workspaceId,
      name: space.name,
      color: space.color,
      createdAt: space.createdAt.toISOString(),
    };
  },
};
