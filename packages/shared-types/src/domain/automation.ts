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
] as const;
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGERS)[number];

export const AUTOMATION_ACTIONS = ['set_status', 'set_priority', 'assign', 'unassign', 'notify', 'comment', 'set_due_date', 'add_watcher'] as const;
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
}

export const AUTOMATION_LIMITS = {
  nameMax: 80,
  actionsMax: 10,
  rulesPerSpace: 50,
  idsMax: 50,
  messageMax: 500,
} as const;

export const AUTOMATION_RUN_STATUSES = ['succeeded', 'failed', 'skipped'] as const;
export type AutomationRunStatus = (typeof AUTOMATION_RUN_STATUSES)[number];

/** Fills a notify message's placeholders. The result is plain text and is shown as text, never HTML. */
export function fillAutomationMessage(message: string, values: { task: string; status: string; actor: string; pr?: string | null }): string {
  return message
    .replaceAll('{{task}}', values.task)
    .replaceAll('{{status}}', values.status)
    .replaceAll('{{actor}}', values.actor)
    .replaceAll('{{pr}}', values.pr ?? '');
}
