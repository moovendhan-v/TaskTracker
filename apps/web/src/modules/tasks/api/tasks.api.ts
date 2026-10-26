import type { CreateTaskRequest, ResourceQuery, TaskRelationKind, UpdateTaskRequest } from '@taskflow/shared-types';
import {
  CreateTaskDocument,
  DeleteTaskDocument,
  RelateTasksDocument,
  SearchTasksDocument,
  StatusesDocument,
  SubtasksDocument,
  TaskActivityDocument,
  TaskByNumberDocument,
  TaskDocument,
  TaskRelationsDocument,
  TaskWatchersDocument,
  UnrelateTasksDocument,
  UpdateTaskDocument,
  WatchTaskDocument,
  type ResourceQueryInput,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

/** Where a search looks: one list, one space (project) or the whole workspace. */
export interface TaskScope {
  spaceId?: string | null;
  listId?: string | null;
}

export const tasksApi = {
  search: async (workspaceId: string, scope: TaskScope, query: ResourceQuery) =>
    (await graphql(SearchTasksDocument, { workspaceId, listId: scope.listId ?? null, spaceId: scope.spaceId ?? null, query: query as ResourceQueryInput })).searchTasks,
  get: async (workspaceId: string, taskId: string) => (await graphql(TaskDocument, { workspaceId, taskId })).task,
  byNumber: async (workspaceId: string, number: number) => (await graphql(TaskByNumberDocument, { workspaceId, number })).taskByNumber,
  subtasks: async (workspaceId: string, taskId: string) => (await graphql(SubtasksDocument, { workspaceId, taskId })).subtasks,
  relations: async (workspaceId: string, taskId: string) => (await graphql(TaskRelationsDocument, { workspaceId, taskId })).taskRelations,
  activity: async (workspaceId: string, taskId: string) => (await graphql(TaskActivityDocument, { workspaceId, taskId })).taskActivity,
  watchers: async (workspaceId: string, taskId: string) => (await graphql(TaskWatchersDocument, { workspaceId, taskId })).taskWatchers,
  create: async (workspaceId: string, listId: string, input: CreateTaskRequest) =>
    (await graphql(CreateTaskDocument, { workspaceId, listId, input })).createTask,
  update: async (workspaceId: string, taskId: string, input: UpdateTaskRequest) =>
    (await graphql(UpdateTaskDocument, { workspaceId, taskId, input })).updateTask,
  remove: async (workspaceId: string, taskId: string) => (await graphql(DeleteTaskDocument, { workspaceId, taskId })).deleteTask,
  watch: async (workspaceId: string, taskId: string, watching: boolean) => (await graphql(WatchTaskDocument, { workspaceId, taskId, watching })).watchTask,
  relate: async (workspaceId: string, taskId: string, relatedTaskId: string, kind: TaskRelationKind) =>
    (await graphql(RelateTasksDocument, { workspaceId, taskId, relatedTaskId, kind })).relateTasks,
  unrelate: async (workspaceId: string, relationId: string) => (await graphql(UnrelateTasksDocument, { workspaceId, relationId })).unrelateTasks,
  statuses: async (workspaceId: string, spaceId: string) => (await graphql(StatusesDocument, { workspaceId, spaceId })).statuses,
};
