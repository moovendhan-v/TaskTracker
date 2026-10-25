export interface TimeEntryResponse {
  id: string;
  userId: string;
  userName: string | null;
  /** Null for work logged without a task. */
  taskId: string | null;
  task: { id: string; number: number; title: string } | null;
  spaceId: string | null;
  spaceName: string | null;
  startedAt: string;
  /** Null while the timer runs. */
  endedAt: string | null;
  minutes: number;
  note: string;
  activity: string;
}

export interface LogTimeRequest {
  taskId?: string | null;
  /** For work without a task; ignored when a task is given (the task's space is used). */
  spaceId?: string | null;
  startedAt: string;
  endedAt: string;
  note?: string;
  activity?: string;
}

export type UpdateTimeEntryRequest = Partial<LogTimeRequest>;

export interface TimeEntryQuery {
  from: string;
  to: string;
  /** Somebody else's entries need time.view_all. Omitted: everyone the caller may see. */
  userIds?: string[];
  spaceId?: string;
  taskId?: string;
}

export interface TaskTimeSummary {
  taskId: string;
  totalMinutes: number;
  myMinutes: number;
  entryCount: number;
}
