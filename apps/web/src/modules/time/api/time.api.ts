import { PAGE_SIZE_MAX, type LogTimeRequest, type ResourceQuery, type TimeEntryQuery, type UpdateTimeEntryRequest } from '@taskflow/shared-types';
import {
  DeleteTimeEntryDocument,
  LogTimeBatchDocument,
  LogTimeDocument,
  RunningTimerDocument,
  SearchTasksDocument,
  StatusesDocument,
  UpdateTaskDocument,
  StartTimerDocument,
  StopTimerDocument,
  TaskTimeSummaryDocument,
  TimeEntriesDocument,
  UpdateTimeEntryDocument,
  type ResourceQueryInput,
} from '@taskflow/sdk';
import { graphql } from '@/core/api/graphql-client';

export const timeApi = {
  running: async (workspaceId: string) => (await graphql(RunningTimerDocument, { workspaceId })).runningTimer,
  list: async (workspaceId: string, query: TimeEntryQuery) => (await graphql(TimeEntriesDocument, { workspaceId, query })).timeEntries,
  taskSummary: async (workspaceId: string, taskId: string) => (await graphql(TaskTimeSummaryDocument, { workspaceId, taskId })).taskTimeSummary,
  start: async (workspaceId: string, input: { taskId?: string | null; spaceId?: string | null; note?: string }) =>
    (await graphql(StartTimerDocument, { workspaceId, input })).startTimer,
  stop: async (workspaceId: string) => (await graphql(StopTimerDocument, { workspaceId })).stopTimer,
  log: async (workspaceId: string, input: LogTimeRequest) => (await graphql(LogTimeDocument, { workspaceId, input })).logTime,
  logBatch: async (workspaceId: string, entries: LogTimeRequest[]) => (await graphql(LogTimeBatchDocument, { workspaceId, input: { entries } })).logTimeBatch,
  update: async (workspaceId: string, entryId: string, input: UpdateTimeEntryRequest) => (await graphql(UpdateTimeEntryDocument, { workspaceId, entryId, input })).updateTimeEntry,
  /** Tasks to log time against: the picker in the log-time dialog and the daily log. */
  pickTasks: async (workspaceId: string, spaceId: string | null, query: ResourceQuery) =>
    (await graphql(SearchTasksDocument, { workspaceId, spaceId, query: { pageSize: PAGE_SIZE_MAX, ...query } as ResourceQueryInput })).searchTasks,
  /** For the daily log's "set status" choice after logging. */
  statuses: async (workspaceId: string, spaceId: string) => (await graphql(StatusesDocument, { workspaceId, spaceId })).statuses,
  setTaskStatus: async (workspaceId: string, taskId: string, statusId: string) => (await graphql(UpdateTaskDocument, { workspaceId, taskId, input: { statusId } })).updateTask,
  remove: async (workspaceId: string, entryId: string) => (await graphql(DeleteTimeEntryDocument, { workspaceId, entryId })).deleteTimeEntry,
};
