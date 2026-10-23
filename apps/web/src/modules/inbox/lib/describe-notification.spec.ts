import { describe, expect, it } from 'vitest';
import { describeNotification } from './describe-notification';

describe('describeNotification', () => {
  it('reads naturally for each kind', () => {
    const base = { actorName: 'Jordan Patel', subject: 'Fix login', excerpt: '' };
    expect(describeNotification({ ...base, kind: 'task_assigned' })).toBe('Jordan Patel assigned you “Fix login”');
    expect(describeNotification({ ...base, kind: 'task_commented' })).toBe('Jordan Patel commented on “Fix login”');
    expect(describeNotification({ ...base, kind: 'leave_decided', subject: 'Annual leave · 2026-11-13', excerpt: 'rejected' })).toBe(
      'Jordan Patel declined your time off: Annual leave · 2026-11-13',
    );
    expect(describeNotification({ ...base, kind: 'member_added', subject: 'Member' })).toBe('Jordan Patel added you to this workspace as Member');
  });

  it('copes with a deleted actor', () => {
    expect(describeNotification({ kind: 'task_assigned', actorName: null, subject: 'x', excerpt: '' })).toBe('Someone assigned you “x”');
  });
});
