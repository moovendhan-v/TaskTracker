import type { SprintResponse } from '@taskflow/shared-types';
import type { SprintWithCounts } from '../domain/sprint.js';

export const SprintMapper = {
  toResponse(sprint: SprintWithCounts): SprintResponse {
    return {
      id: sprint.id,
      spaceId: sprint.spaceId,
      name: sprint.name,
      goal: sprint.goal,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      status: sprint.status,
      totalTasks: sprint.totalTasks,
      doneTasks: sprint.doneTasks,
      completedAt: sprint.completedAt ? sprint.completedAt.toISOString() : null,
    };
  },
};
