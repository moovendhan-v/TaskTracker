/** Time someone spent, on a task or on a space without a task. A running timer has no end yet. */
export interface TimeEntry {
  id: string;
  workspaceId: string;
  userId: string;
  taskId: string | null;
  spaceId: string | null;
  startedAt: Date;
  endedAt: Date | null;
  minutes: number;
  note: string;
  activity: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NewTimeEntry = Omit<TimeEntry, 'id' | 'createdAt' | 'updatedAt'>;

/** An entry with the names a listing shows next to it. */
export interface TimeEntryView extends TimeEntry {
  userName: string | null;
  taskNumber: number | null;
  taskTitle: string | null;
  spaceName: string | null;
}

export interface TimeEntryFilter {
  from: Date;
  to: Date;
  /** Omitted: everyone. */
  userIds?: readonly string[];
  spaceId?: string;
  taskId?: string;
  limit: number;
}
