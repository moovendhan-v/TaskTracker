import {
  AUTOMATION_ACTIONS,
  AUTOMATION_LIMITS,
  AUTOMATION_TRIGGERS,
  NOTIFY_AUDIENCES,
  STATUS_CATEGORIES,
  TASK_PRIORITIES,
  TASK_TYPES,
  type AutomationAction,
  type AutomationConditions,
  type AutomationTrigger,
  type AutomationTriggerType,
  type Permission,
  type StatusCategory,
  type TaskPriority,
  type TaskType,
} from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';

/** The task an automation looks at, after the change that triggered it. */
export interface TaskFacts {
  listId: string;
  statusId: string;
  statusCategory: StatusCategory;
  priority: TaskPriority;
  type: TaskType;
}

/** Ids a rule mentions, for the service to check against the space and its members. */
export interface ReferencedIds {
  statusIds: string[];
  listIds: string[];
  userIds: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function list<T extends string>(values: readonly unknown[] | null | undefined, allowed: readonly T[] | null, what: string): T[] {
  if (!values) return [];
  if (values.length > AUTOMATION_LIMITS.idsMax) throw DomainError.invalid(`Too many ${what}`);
  for (const value of values) {
    if (typeof value !== 'string' || (allowed ? !(allowed as readonly string[]).includes(value) : !UUID.test(value))) throw DomainError.invalid(`Unknown ${what.replace(/s$/, '')}`);
  }
  return [...new Set(values as T[])];
}

/** What each action needs from the person the rule runs as. */
const ACTION_PERMISSIONS: Record<AutomationAction['type'], Permission[]> = {
  set_status: ['task.update'],
  set_priority: ['task.update'],
  assign: ['task.update', 'task.assign'],
  unassign: ['task.update', 'task.assign'],
  notify: [],
};

export const AutomationPolicy = {
  normalizeTrigger(trigger: AutomationTrigger): AutomationTrigger {
    if (!AUTOMATION_TRIGGERS.includes(trigger.type)) throw DomainError.invalid('Unknown trigger');
    return {
      type: trigger.type,
      ...(trigger.type === 'task_status_changed'
        ? { statusIds: list(trigger.statusIds, null, 'statuses'), categories: list(trigger.categories, STATUS_CATEGORIES, 'categories') }
        : {}),
      ...(trigger.type === 'task_priority_changed' ? { priorities: list(trigger.priorities, TASK_PRIORITIES, 'priorities') } : {}),
    };
  },

  normalizeConditions(conditions: AutomationConditions | undefined): AutomationConditions {
    return {
      listIds: list(conditions?.listIds, null, 'lists'),
      priorities: list(conditions?.priorities, TASK_PRIORITIES, 'priorities'),
      types: list(conditions?.types, TASK_TYPES, 'types'),
    };
  },

  normalizeActions(actions: readonly AutomationAction[]): AutomationAction[] {
    if (actions.length === 0) throw DomainError.invalid('Add at least one action');
    if (actions.length > AUTOMATION_LIMITS.actionsMax) throw DomainError.invalid(`Use at most ${AUTOMATION_LIMITS.actionsMax} actions`);
    return actions.map((action, index) => {
      const where = `Action ${index + 1}`;
      if (!AUTOMATION_ACTIONS.includes(action.type)) throw DomainError.invalid(`${where}: unknown action`);
      switch (action.type) {
        case 'set_status':
          if (!action.statusId || !UUID.test(action.statusId)) throw DomainError.invalid(`${where}: pick a status`);
          return { type: action.type, statusId: action.statusId };
        case 'set_priority':
          if (!action.priority || !TASK_PRIORITIES.includes(action.priority)) throw DomainError.invalid(`${where}: pick a priority`);
          return { type: action.type, priority: action.priority };
        case 'assign':
          if (!action.userId || typeof action.userId !== 'string' || action.userId.length > 64) throw DomainError.invalid(`${where}: pick a person`);
          return { type: action.type, userId: action.userId };
        case 'unassign':
          return { type: action.type };
        case 'notify': {
          const audiences = list(action.audiences, NOTIFY_AUDIENCES, 'audiences');
          const userIds = [...new Set((action.userIds ?? []).filter((id) => typeof id === 'string' && id.length <= 64))].slice(0, AUTOMATION_LIMITS.idsMax);
          if (audiences.length === 0 && userIds.length === 0) throw DomainError.invalid(`${where}: choose who to notify`);
          const message = (action.message ?? '').trim();
          if (!message) throw DomainError.invalid(`${where}: write a message`);
          if (message.length > AUTOMATION_LIMITS.messageMax) throw DomainError.invalid(`${where}: the message is too long`);
          return { type: action.type, audiences, userIds, message };
        }
      }
    });
  },

  referencedIds(trigger: AutomationTrigger, conditions: AutomationConditions, actions: readonly AutomationAction[]): ReferencedIds {
    return {
      statusIds: [...(trigger.statusIds ?? []), ...actions.flatMap((action) => (action.statusId ? [action.statusId] : []))],
      listIds: [...(conditions.listIds ?? [])],
      userIds: actions.flatMap((action) => [...(action.userId ? [action.userId] : []), ...(action.userIds ?? [])]),
    };
  },

  /** Permissions the rule's actions need from the person it runs as. */
  requiredPermissions(actions: readonly AutomationAction[]): Permission[] {
    return [...new Set(actions.flatMap((action) => ACTION_PERMISSIONS[action.type]))];
  },

  /** Whether a rule listens for this trigger, given the task as it now is. */
  matches(rule: { trigger: AutomationTrigger; conditions: AutomationConditions }, triggerType: AutomationTriggerType, task: TaskFacts): boolean {
    const { trigger, conditions } = rule;
    if (trigger.type !== triggerType) return false;
    if (trigger.statusIds?.length && !trigger.statusIds.includes(task.statusId)) return false;
    if (trigger.categories?.length && !trigger.categories.includes(task.statusCategory)) return false;
    if (trigger.priorities?.length && !trigger.priorities.includes(task.priority)) return false;
    if (conditions.listIds?.length && !conditions.listIds.includes(task.listId)) return false;
    if (conditions.priorities?.length && !conditions.priorities.includes(task.priority)) return false;
    if (conditions.types?.length && !conditions.types.includes(task.type)) return false;
    return true;
  },

  /** Which triggers a task change fires, from the event's description of it. */
  triggersForTaskEvent(event: { type: string; facts?: { changes?: readonly { field: string }[]; assigneeId?: string | null; previousAssigneeId?: string | null } }): AutomationTriggerType[] {
    if (event.type === 'task.created') return ['task_created'];
    if (event.type === 'comment.created') return ['task_commented'];
    if (event.type !== 'task.updated') return [];
    const fields = new Set((event.facts?.changes ?? []).map((change) => change.field));
    const triggers: AutomationTriggerType[] = [];
    if (fields.has('status')) triggers.push('task_status_changed');
    if (fields.has('priority')) triggers.push('task_priority_changed');
    if (fields.has('due date')) triggers.push('task_due_date_changed');
    if (fields.has('assignee') && event.facts?.assigneeId && event.facts.assigneeId !== event.facts.previousAssigneeId) triggers.push('task_assigned');
    return triggers;
  },
};
