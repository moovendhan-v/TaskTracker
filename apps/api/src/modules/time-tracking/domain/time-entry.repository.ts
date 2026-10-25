import type { NewTimeEntry, TimeEntry, TimeEntryFilter, TimeEntryView } from './time-entry.js';

export abstract class TimeEntryRepository {
  abstract findInWorkspace(workspaceId: string, entryId: string): Promise<TimeEntry | null>;
  abstract findView(workspaceId: string, entryId: string): Promise<TimeEntryView | null>;
  /** The user's running timer in the workspace, if any (there is at most one). */
  abstract running(workspaceId: string, userId: string): Promise<TimeEntry | null>;
  abstract list(workspaceId: string, filter: TimeEntryFilter): Promise<TimeEntryView[]>;
  abstract create(entry: NewTimeEntry): Promise<TimeEntry>;
  abstract save(entry: TimeEntry): Promise<TimeEntry>;
  abstract delete(workspaceId: string, entryId: string): Promise<void>;
  /** Finished minutes on a task: everyone's and the given user's. */
  abstract totalsForTask(workspaceId: string, taskId: string, userId: string): Promise<{ total: number; mine: number; count: number }>;
}
