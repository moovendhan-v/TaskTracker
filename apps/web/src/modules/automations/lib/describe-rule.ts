import type { AutomationAction, AutomationConditions, AutomationTrigger, AutomationTriggerType, NotifyAudience, StatusCategory, TaskPriority } from '@taskflow/shared-types';

export const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  task_created: 'A task is created',
  task_status_changed: 'Status changes',
  task_assigned: 'A task is assigned',
  task_priority_changed: 'Priority changes',
  task_due_date_changed: 'Due date changes',
  task_commented: 'Someone comments',
  github_pull_request_opened: 'A linked pull request is opened',
  github_pull_request_merged: 'A linked pull request is merged',
  github_pull_request_closed: 'A linked pull request is closed without merging',
};

export const ACTION_LABELS: Record<AutomationAction['type'], string> = {
  set_status: 'Change the status',
  set_priority: 'Change the priority',
  assign: 'Assign to someone',
  unassign: 'Unassign',
  notify: 'Notify people',
};

export const AUDIENCE_LABELS: Record<NotifyAudience, string> = {
  assignee: 'The assignee',
  creator: 'The creator',
  watchers: 'Watchers',
  actor: 'Whoever made the change',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low', none: 'No priority' };

export const CATEGORY_LABELS: Record<StatusCategory, string> = {
  unstarted: 'not started',
  started: 'active',
  review: 'in review',
  blocked: 'blocked',
  done: 'done',
  cancelled: 'cancelled',
};

interface Names {
  status: (id: string) => string;
  list: (id: string) => string;
  person: (id: string) => string;
}

/** The rule as one sentence: "When status changes to Done in Bugs, then notify the creator." */
export function describeRule(rule: { trigger: AutomationTrigger; conditions: AutomationConditions; actions: AutomationAction[] }, names: Names): string {
  const { trigger, conditions } = rule;
  let when = TRIGGER_LABELS[trigger.type].replace(/^A /, 'a ').replace(/^([A-Z])/, (letter) => letter.toLowerCase());
  const targets = [...(trigger.statusIds ?? []).map(names.status), ...(trigger.categories ?? []).map((category) => `any ${CATEGORY_LABELS[category]} status`)];
  if (targets.length) when += ` to ${targets.join(' or ')}`;
  if (trigger.priorities?.length) when += ` to ${trigger.priorities.map((priority) => PRIORITY_LABELS[priority]).join(' or ')}`;
  const filters: string[] = [];
  if (conditions.listIds?.length) filters.push(`in ${conditions.listIds.map(names.list).join(', ')}`);
  if (conditions.types?.length) filters.push(`for ${conditions.types.join(', ')} tasks`);
  if (conditions.priorities?.length) filters.push(`when priority is ${conditions.priorities.map((priority) => PRIORITY_LABELS[priority]).join(' or ')}`);
  const then = rule.actions.map((action) => {
    switch (action.type) {
      case 'set_status':
        return `set the status to ${action.statusId ? names.status(action.statusId) : '…'}`;
      case 'set_priority':
        return `set the priority to ${action.priority ? PRIORITY_LABELS[action.priority] : '…'}`;
      case 'assign':
        return `assign ${action.userId ? names.person(action.userId) : '…'}`;
      case 'unassign':
        return 'unassign it';
      case 'notify': {
        const who = [...(action.audiences ?? []).map((audience) => AUDIENCE_LABELS[audience].toLowerCase()), ...(action.userIds ?? []).map(names.person)];
        return `notify ${who.length ? who.join(', ') : '…'}`;
      }
    }
  });
  return `When ${when}${filters.length ? ` ${filters.join(' ')}` : ''}, then ${then.length ? then.join(', then ') : '…'}.`;
}
