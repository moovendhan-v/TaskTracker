import type { CompleteSprintRequest, CreateSprintRequest, UpdateSprintRequest } from '@taskflow/shared-types';
import {
  BacklogDocument,
  CompleteSprintDocument,
  TeamAvailabilityDocument,
  CreateSprintDocument,
  DeleteSprintDocument,
  SprintDocument,
  SprintsDocument,
  SprintTasksDocument,
  StartSprintDocument,
  UpdateSprintDocument,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

type SprintPath = { workspaceId: string; sprintId: string };

export const sprintsApi = {
  listInSpace: async (workspaceId: string, spaceId: string) => (await graphql(SprintsDocument, { workspaceId, spaceId })).sprints,
  get: async (path: SprintPath) => (await graphql(SprintDocument, path)).sprint,
  create: async (workspaceId: string, spaceId: string, input: CreateSprintRequest) =>
    (await graphql(CreateSprintDocument, { workspaceId, spaceId, input })).createSprint,
  update: async (path: SprintPath, input: UpdateSprintRequest) => (await graphql(UpdateSprintDocument, { ...path, input })).updateSprint,
  remove: async (path: SprintPath) => (await graphql(DeleteSprintDocument, path)).deleteSprint,
  start: async (path: SprintPath) => (await graphql(StartSprintDocument, path)).startSprint,
  complete: async (path: SprintPath, { moveOpenTasksToSprintId, moves }: CompleteSprintRequest) =>
    (await graphql(CompleteSprintDocument, { ...path, moveOpenTasksToSprintId, rollover: moves?.length ? { moves } : null })).completeSprint,
  tasks: async (path: SprintPath) => (await graphql(SprintTasksDocument, path)).sprintTasks,
  /** Approved leave in the range, dates only (needs sprint.manage). */
  availability: async (workspaceId: string, from: string, to: string) => (await graphql(TeamAvailabilityDocument, { workspaceId, from, to })).teamAvailability,
  backlog: async (workspaceId: string, spaceId: string) => (await graphql(BacklogDocument, { workspaceId, spaceId })).backlog,
};
