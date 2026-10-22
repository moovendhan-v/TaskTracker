import type { CreateTaskRequest, TaskQuery, UpdateTaskRequest } from '@taskflow/shared-types';
import { CreateTaskDocument, DeleteTaskDocument, TaskDocument, TasksDocument, UpdateTaskDocument } from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const tasksApi = {
  listInList: async (workspaceId: string, listId: string, query: TaskQuery) =>
    (await graphql(TasksDocument, { workspaceId, listId, ...query })).tasks,
  get: async (workspaceId: string, taskId: string) => (await graphql(TaskDocument, { workspaceId, taskId })).task,
  create: async (workspaceId: string, listId: string, input: CreateTaskRequest) =>
    (await graphql(CreateTaskDocument, { workspaceId, listId, input })).createTask,
  update: async (workspaceId: string, taskId: string, input: UpdateTaskRequest) =>
    (await graphql(UpdateTaskDocument, { workspaceId, taskId, input })).updateTask,
  remove: async (workspaceId: string, taskId: string) => (await graphql(DeleteTaskDocument, { workspaceId, taskId })).deleteTask,
};
