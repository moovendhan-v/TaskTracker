import { describe, expect, it } from 'vitest';
import { domainEvent, type DomainEventFacts } from '../../../core/events/domain-event.js';
import { NotificationRules } from './notification-rules.js';

const W = 'workspace-1';
const event = (type: Parameters<typeof domainEvent>[0], change: Parameters<typeof domainEvent>[1], facts: DomainEventFacts, actorId = 'avery') =>
  domainEvent(type, change, { workspaceId: W, entityId: 'entity-1', actorId, facts });
const recipients = (e: ReturnType<typeof event>, approverIds: string[] = []) =>
  NotificationRules.notificationsFor(e, { approverIds }).map((n) => `${n.recipientId}:${n.kind}`);

describe('NotificationRules', () => {
  it('tells the new assignee, but not when people assign themselves', () => {
    expect(recipients(event('task', 'created', { title: 'Ship it', assigneeId: 'sam' }))).toEqual(['sam:task_assigned']);
    expect(recipients(event('task', 'created', { title: 'Mine', assigneeId: 'avery' }))).toEqual([]);
    expect(recipients(event('task', 'updated', { assigneeId: 'sam', previousAssigneeId: 'jordan' }))).toEqual(['sam:task_assigned']);
    expect(recipients(event('task', 'updated', { assigneeId: 'sam', previousAssigneeId: 'sam' }))).toEqual([]);
  });

  it('tells the assignee and the creator about comments, once each, never the author', () => {
    const comment = event('comment', 'created', { taskId: 't1', assigneeId: 'sam', createdById: 'sam', excerpt: 'Looks good' }, 'jordan');
    expect(recipients(comment)).toEqual(['sam:task_commented']);
    const [notification] = NotificationRules.notificationsFor(comment, { approverIds: [] });
    expect(notification).toMatchObject({ taskId: 't1', excerpt: 'Looks good' });
  });

  it('asks approvers about pending leave, and tells the requester the decision', () => {
    const pending = event('leave_request', 'created', { status: 'pending', title: 'Annual leave' }, 'sam');
    expect(NotificationRules.needsApprovers(pending)).toBe(true);
    expect(recipients(pending, ['avery', 'sam', 'jordan'])).toEqual(['avery:leave_requested', 'jordan:leave_requested']);
    expect(recipients(event('leave_request', 'created', { status: 'approved' }, 'sam'), ['avery'])).toEqual([]);
    expect(recipients(event('leave_request', 'updated', { status: 'approved', userId: 'sam' }))).toEqual(['sam:leave_decided']);
    expect(recipients(event('leave_request', 'updated', { status: 'cancelled', userId: 'sam' }, 'sam'))).toEqual([]);
  });

  it('welcomes people added to a workspace', () => {
    expect(recipients(event('member', 'created', { userId: 'sam', roleName: 'Member' }))).toEqual(['sam:member_added']);
  });

  it('keeps subjects and excerpts short and on one line', () => {
    const [n] = NotificationRules.notificationsFor(
      event('comment', 'created', { assigneeId: 'sam', title: 'Fix\nthe bug', excerpt: 'x'.repeat(500) }, 'jordan'),
      { approverIds: [] },
    );
    expect(n?.subject).toBe('Fix the bug');
    expect(n?.excerpt).toHaveLength(140);
  });
});
