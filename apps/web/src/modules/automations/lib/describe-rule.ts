import { describeWait, type AutomationAction, type AutomationConditions, type AutomationFlow, type AutomationTrigger, type AutomationTriggerType, type FlowCondition, type NotifyAudience, type StatusCategory, type TaskPriority } from '@taskflow/shared-types';

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
  task_due_soon: 'A task is due soon',
  task_overdue: 'A task becomes overdue',
};

export const ACTION_LABELS: Record<AutomationAction['type'], string> = {
  set_status: 'Change the status',
  set_priority: 'Change the priority',
  assign: 'Assign to someone',
  unassign: 'Unassign',
  notify: 'Notify people',
  comment: 'Add a comment',
  set_due_date: 'Set the due date',
  add_watcher: 'Add a watcher',
  post_chat: 'Post in chat',
  webhook: 'Call a webhook',
  move_to_list: 'Move to a list',
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

export interface Names {
  status: (id: string) => string;
  list: (id: string) => string;
  person: (id: string) => string;
  channel?: (id: string) => string;
}

/** The rule as one sentence: "When status changes to Done in Bugs, then notify the creator." */
export function describeRule(rule: { trigger: AutomationTrigger; conditions: AutomationConditions; actions: AutomationAction[] }, names: Names): string {
  const { trigger, conditions } = rule;
  let when = TRIGGER_LABELS[trigger.type].replace(/^A /, 'a ').replace(/^([A-Z])/, (letter) => letter.toLowerCase());
  const targets = [...(trigger.statusIds ?? []).map(names.status), ...(trigger.categories ?? []).map((category) => `any ${CATEGORY_LABELS[category]} status`)];
  if (targets.length) when += ` to ${targets.join(' or ')}`;
  if (trigger.priorities?.length) when += ` to ${trigger.priorities.map((priority) => PRIORITY_LABELS[priority]).join(' or ')}`;
  if (trigger.type === 'task_due_soon') when += dueSoonWindow(trigger.days ?? 1);
  const filters: string[] = [];
  if (conditions.listIds?.length) filters.push(`in ${conditions.listIds.map(names.list).join(', ')}`);
  if (conditions.types?.length) filters.push(`for ${conditions.types.join(', ')} tasks`);
  if (conditions.priorities?.length) filters.push(`when priority is ${conditions.priorities.map((priority) => PRIORITY_LABELS[priority]).join(' or ')}`);
  const then = rule.actions.map((action) => describeAction(action, names));
  return `When ${when}${filters.length ? ` ${filters.join(' ')}` : ''}, then ${then.length ? then.join(', then ') : '…'}.`;
}

/** " (due today)", " (within 3 days)". */
export function dueSoonWindow(days: number): string {
  return days === 0 ? ' (due today)' : ` (within ${days} ${days === 1 ? 'day' : 'days'})`;
}

function hostOf(url: string | null | undefined): string {
  if (!url) return '…';
  try {
    return new URL(url).host;
  } catch {
    return 'a URL';
  }
}

/** One action in words: "set the priority to High". */
export function describeAction(action: AutomationAction, names: Names): string {
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
    case 'comment':
      return action.message ? `comment “${action.message.length > 40 ? `${action.message.slice(0, 39)}…` : action.message}”` : 'add a comment';
    case 'set_due_date':
      return action.days === null || action.days === undefined ? 'clear the due date' : action.days === 0 ? 'make it due today' : `make it due in ${action.days} ${action.days === 1 ? 'day' : 'days'}`;
    case 'add_watcher':
      return `add ${action.userId ? names.person(action.userId) : '…'} as a watcher`;
    case 'post_chat':
      return `post in ${action.channelId ? `#${names.channel?.(action.channelId) ?? 'a channel'}` : '…'}`;
    case 'webhook':
      return `call a webhook on ${hostOf(action.url)}`;
    case 'move_to_list':
      return `move it to ${action.listId ? names.list(action.listId) : '…'}`;
  }
}

/** A condition in words: "priority is Urgent or High". */
export function describeCondition(condition: FlowCondition, names: Names): string {
  switch (condition.field) {
    case 'status':
      return `status is ${[...(condition.statusIds ?? []).map(names.status), ...(condition.categories ?? []).map((category) => `any ${CATEGORY_LABELS[category]} status`)].join(' or ') || '…'}`;
    case 'priority':
      return `priority is ${condition.priorities.map((priority) => PRIORITY_LABELS[priority]).join(' or ') || '…'}`;
    case 'type':
      return `type is ${condition.types.join(' or ') || '…'}`;
    case 'list':
      return `it's in ${condition.listIds.map(names.list).join(' or ') || '…'}`;
    case 'assignee':
      return condition.match === 'unassigned' ? 'nobody is assigned' : condition.match === 'anyone' ? 'someone is assigned' : `${(condition.userIds ?? []).map(names.person).join(' or ') || '…'} is assigned`;
    case 'due':
      return condition.match === 'none' ? 'it has no due date' : condition.match === 'overdue' ? "it's overdue" : `it's due within ${condition.days ?? 0} ${condition.days === 1 ? 'day' : 'days'}`;
    case 'title':
      return `the title contains “${condition.contains}”`;
  }
}

/** The whole flow in a sentence, for the builder footer and the list. */
export function describeFlow(trigger: AutomationTrigger, flow: AutomationFlow, names: Names): string {
  const when = describeRule({ trigger, conditions: {}, actions: [] }, names).replace(/, then ….$/, '');
  const steps = flow.steps.map((step): string =>
    step.kind === 'action' ? describeAction(step.action, names) : step.kind === 'stop' ? 'stop' : step.kind === 'wait' ? `wait ${describeWait(step.minutes)}` : `if ${describeCondition(step.condition, names)}, ${step.yes.length} ${step.yes.length === 1 ? 'step' : 'steps'}, otherwise ${step.no.length || 'nothing'}`,
  );
  return `${when}, then ${steps.join(', then ') || '…'}.`;
}
