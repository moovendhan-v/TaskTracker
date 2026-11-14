import type { StatusCategory, TaskPriority, TaskType } from './task.js';

/**
 * Automations: "when <trigger> (and <conditions>), then <actions>", per space.
 * Rules run as the person who made them, with that person's current access;
 * changes an automation makes never trigger other automations.
 */
export const AUTOMATION_TRIGGERS = [
  'task_created',
  'task_status_changed',
  'task_assigned',
  'task_priority_changed',
  'task_due_date_changed',
  'task_commented',
  'github_pull_request_opened',
  'github_pull_request_merged',
  'github_pull_request_closed',
  'task_due_soon',
  'task_overdue',
  'on_schedule',
  'sprint_started',
  'sprint_completed',
] as const;
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGERS)[number];

/**
 * Triggers that no change fires: a background sweep checks the clock and fires
 * each of these once per task and due date (E1 phase 2).
 */
export const SCHEDULED_TRIGGERS = ['task_due_soon', 'task_overdue', 'on_schedule'] as const satisfies readonly AutomationTriggerType[];

/** Triggers a sprint starting or completing fires, once for each task in the sprint. */
export const SPRINT_TRIGGERS = ['sprint_started', 'sprint_completed'] as const satisfies readonly AutomationTriggerType[];

export function isSprintTrigger(type: AutomationTriggerType): type is (typeof SPRINT_TRIGGERS)[number] {
  return (SPRINT_TRIGGERS as readonly string[]).includes(type);
}

/** How often an on_schedule rule runs. */
export const SCHEDULE_FREQUENCIES = ['daily', 'weekdays', 'weekly', 'monthly'] as const;
export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];

/**
 * When an on_schedule rule runs: at `time` (24-hour HH:MM) in `timeZone`, every
 * day, Monday to Friday, on the chosen weekdays (0 = Sunday … 6 = Saturday), or
 * on one day of the month (1–28, so every month has it).
 */
export interface AutomationSchedule {
  frequency: ScheduleFrequency;
  time: string;
  timeZone: string;
  weekdays?: number[] | null;
  monthDay?: number | null;
}
export type ScheduledTriggerType = (typeof SCHEDULED_TRIGGERS)[number];

export function isScheduledTrigger(type: AutomationTriggerType): type is ScheduledTriggerType {
  return (SCHEDULED_TRIGGERS as readonly string[]).includes(type);
}

export const AUTOMATION_ACTIONS = ['set_status', 'set_priority', 'assign', 'unassign', 'notify', 'comment', 'set_due_date', 'add_watcher', 'post_chat', 'webhook', 'move_to_list'] as const;
export type AutomationActionType = (typeof AUTOMATION_ACTIONS)[number];

/** Who a notify action reaches, besides people named by id. */
export const NOTIFY_AUDIENCES = ['assignee', 'creator', 'watchers', 'actor'] as const;
export type NotifyAudience = (typeof NOTIFY_AUDIENCES)[number];

export interface AutomationTrigger {
  type: AutomationTriggerType;
  /** task_status_changed: only when it moves to one of these statuses (any when empty). */
  statusIds?: string[] | null;
  /** task_status_changed: only when it moves into one of these categories. */
  categories?: StatusCategory[] | null;
  /** task_priority_changed: only when it becomes one of these. */
  priorities?: TaskPriority[] | null;
  /** task_due_soon: how many days ahead counts as soon (0 = due today). */
  days?: number | null;
  /** on_schedule: when it runs. */
  schedule?: AutomationSchedule | null;
}

/** Every condition that is set must hold for the task, as it is after the change. */
export interface AutomationConditions {
  /** Only tasks in these lists ("sources"); empty means the whole space. */
  listIds?: string[] | null;
  priorities?: TaskPriority[] | null;
  types?: TaskType[] | null;
}

export interface AutomationAction {
  type: AutomationActionType;
  statusId?: string | null;
  priority?: TaskPriority | null;
  userId?: string | null;
  /** notify */
  audiences?: NotifyAudience[] | null;
  userIds?: string[] | null;
  /** notify and comment: plain text; {{task}}, {{status}}, {{actor}} and {{pr}} are filled in. */
  message?: string | null;
  /** set_due_date: days from the day it runs (0 = today); null clears the due date. */
  days?: number | null;
  /** post_chat: the channel to post in (one the rule's owner can post to). */
  channelId?: string | null;
  /** webhook: an https:// URL on a host this server allows (AUTOMATION_WEBHOOK_HOSTS). */
  url?: string | null;
  /** move_to_list: a list in the rule's space; the task moves there with its subtasks. */
  listId?: string | null;
}

export const AUTOMATION_LIMITS = {
  nameMax: 80,
  actionsMax: 10,
  rulesPerSpace: 50,
  idsMax: 50,
  messageMax: 500,
  urlMax: 500,
  /** task_due_soon looks at most this many days ahead. */
  dueSoonDaysMax: 30,
  /** Tasks one scheduled or sprint run acts on at most (the rest wait for the next tick, or are skipped for a sprint). */
  tasksPerRun: 100,
} as const;

/** `waiting`: the run reached a wait step and resumes later (its trace grows when it does). */
export const AUTOMATION_RUN_STATUSES = ['succeeded', 'failed', 'skipped', 'waiting'] as const;
export type AutomationRunStatus = (typeof AUTOMATION_RUN_STATUSES)[number];

/** Fills a notify message's placeholders. The result is plain text and is shown as text, never HTML. */
export function fillAutomationMessage(message: string, values: { task: string; status: string; actor: string; pr?: string | null; sprint?: string | null }): string {
  return message
    .replaceAll('{{task}}', values.task)
    .replaceAll('{{status}}', values.status)
    .replaceAll('{{actor}}', values.actor)
    .replaceAll('{{pr}}', values.pr ?? '')
    .replaceAll('{{sprint}}', values.sprint ?? '');
}

/** The parts of an instant in a time zone. */
function zoned(instant: Date, timeZone: string): { date: string; weekday: number; day: number; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts['weekday'] ?? '');
  return { date: `${parts['year']}-${parts['month']}-${parts['day']}`, weekday, day: Number(parts['day']), minutes: Number(parts['hour']) * 60 + Number(parts['minute']) };
}

/** Whether the schedule runs on a calendar day (its weekday 0–6 and day of month 1–31). */
export function scheduleRunsOn(schedule: AutomationSchedule, weekday: number, day: number): boolean {
  switch (schedule.frequency) {
    case 'daily':
      return true;
    case 'weekdays':
      return weekday >= 1 && weekday <= 5;
    case 'weekly':
      return (schedule.weekdays ?? []).includes(weekday);
    case 'monthly':
      return day === schedule.monthDay;
  }
}

/** Minutes after midnight of an HH:MM time. */
export const scheduleMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/**
 * Today's run, if it's due: the local date (YYYY-MM-DD, in the schedule's time
 * zone) when today is a run day and its time has passed; otherwise null. The
 * scheduler fires each date once, so a late tick still runs the same day.
 */
export function dueScheduleDate(schedule: AutomationSchedule, now: Date): string | null {
  const here = zoned(now, schedule.timeZone);
  if (!scheduleRunsOn(schedule, here.weekday, here.day)) return null;
  return here.minutes >= scheduleMinutes(schedule.time) ? here.date : null;
}
