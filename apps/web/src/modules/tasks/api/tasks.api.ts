import type { CreateTaskRequest, UpdateTaskRequest } from '@taskflow/shared-types';
import {
  CreateTaskDocument,
  DeleteTaskDocument,
  SearchTasksDocument,
  StatusesDocument,
  TaskDocument,
  UpdateTaskDocument,
  type ResourceQueryInput,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const tasksApi = {
  searchInList: async (workspaceId: string, listId: string, query: ResourceQueryInput) =>
    (await graphql(SearchTasksDocument, { workspaceId, listId, query })).searchTasks,
  get: async (workspaceId: string, taskId: string) => (await graphql(TaskDocument, { workspaceId, taskId })).task,
  create: async (workspaceId: string, listId: string, input: CreateTaskRequest) =>
    (await graphql(CreateTaskDocument, { workspaceId, listId, input })).createTask,
  update: async (workspaceId: string, taskId: string, input: UpdateTaskRequest) =>
    (await graphql(UpdateTaskDocument, { workspaceId, taskId, input })).updateTask,
  remove: async (workspaceId: string, taskId: string) => (await graphql(DeleteTaskDocument, { workspaceId, taskId })).deleteTask,
  statuses: async (workspaceId: string, spaceId: string) => (await graphql(StatusesDocument, { workspaceId, spaceId })).statuses,
};
