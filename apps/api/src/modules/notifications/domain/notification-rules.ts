import type { DomainEvent } from '../../../core/events/domain-event.js';
import type { NewNotification } from './notification.js';

const SUBJECT_MAX = 300;
const EXCERPT_MAX = 140;

/** Who else may need to hear about an event, looked up by the caller (e.g. leave approvers). */
export interface RuleContext {
  approverIds: readonly string[];
}

/**
 * Decides who gets notified about an event and what it says. Pure, so the rules
 * are easy to test. People are never notified about their own actions.
 */
export const NotificationRules = {
  /** True when the rules need the leave approvers for this event. */
  needsApprovers(event: DomainEvent): boolean {
    return event.type === 'leave_request.created' && event.facts?.status === 'pending';
  },

  notificationsFor(event: DomainEvent, context: RuleContext): NewNotification[] {
    const facts = event.facts ?? {};
    const base = {
      workspaceId: event.workspaceId,
      actorId: event.actorId,
      entityType: event.entityType,
      entityId: event.entityId,
      subject: truncate(facts.title ?? '', SUBJECT_MAX),
      excerpt: truncate(facts.excerpt ?? '', EXCERPT_MAX),
      taskId: null as string | null,
    };
    const to = (recipients: Iterable<string | null | undefined>, fields: Pick<NewNotification, 'kind'> & Partial<NewNotification>) =>
      unique(recipients)
        .filter((recipient) => recipient !== event.actorId)
        .map((recipientId) => ({ ...base, ...fields, recipientId }));

    switch (event.type) {
      case 'task.created':
        return to([facts.assigneeId], { kind: 'task_assigned', taskId: event.entityId });
      case 'task.updated':
        if (!facts.assigneeId || facts.assigneeId === facts.previousAssigneeId) return [];
        return to([facts.assigneeId], { kind: 'task_assigned', taskId: event.entityId });
      case 'comment.created':
        return to([facts.assigneeId, facts.createdById, ...(facts.watcherIds ?? [])], { kind: 'task_commented', taskId: facts.taskId ?? null });
      case 'leave_request.created':
        return facts.status === 'pending' ? to(context.approverIds, { kind: 'leave_requested' }) : [];
      case 'leave_request.updated':
        return facts.status === 'approved' || facts.status === 'rejected'
          ? to([facts.userId], { kind: 'leave_decided', excerpt: facts.status })
          : [];
      case 'chat_message.created':
        return to(facts.mentionIds ?? [], { kind: 'chat_mention' });
      case 'member.created':
        return to([facts.userId], { kind: 'member_added', subject: truncate(facts.roleName ?? '', SUBJECT_MAX) });
      default:
        return [];
    }
  },
};

function unique(values: Iterable<string | null | undefined>): string[] {
  return [...new Set([...values].filter((value): value is string => Boolean(value)))];
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
