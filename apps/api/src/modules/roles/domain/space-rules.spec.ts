import { describe, expect, it } from 'vitest';
import { canInSpace, evaluatePolicies, keepsSpaceRules, spaceVisibility, type Permission } from '@taskflow/shared-types';
import { PolicyDocumentPolicy } from './policy-document.policy.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

describe('space-limited statements', () => {
  const contributor = { effect: 'allow' as const, permissions: ['task.*', 'doc.view'] };

  it('takes permissions away only inside the named spaces', () => {
    const access = evaluatePolicies([{ statements: [contributor, { effect: 'deny', permissions: ['task.update'], spaces: [A] }] }]);
    expect(access.permissions).toContain('task.update');
    expect(canInSpace(access, A, 'task.update')).toBe(false);
    expect(canInSpace(access, B, 'task.update')).toBe(true);
    expect(canInSpace(access, A, 'task.view')).toBe(true);
  });

  it('applies notSpaces everywhere except the listed spaces', () => {
    const access = evaluatePolicies([{ statements: [contributor, { effect: 'deny', permissions: ['task.*'], notSpaces: [B] }] }]);
    expect(canInSpace(access, B, 'task.view')).toBe(true);
    expect(canInSpace(access, A, 'task.view')).toBe(false);
    expect(canInSpace(access, C, 'task.create')).toBe(false);
  });

  it('expands * to the permissions that apply inside a space, and ignores the rest', () => {
    const access = evaluatePolicies([{ statements: [{ effect: 'allow', permissions: ['*'] }, { effect: 'deny', permissions: ['*'], spaces: [A] }] }]);
    expect(access.spaceRules[0]?.permissions).toContain('space.manage');
    expect(access.spaceRules[0]?.permissions).not.toContain('members.manage' as Permission);
    expect(access.permissions).toContain('members.manage');
  });

  it('turns rules into the deny and only lists row-level security reads', () => {
    const rules = evaluatePolicies([
      {
        statements: [
          { effect: 'deny', permissions: ['task.view'], spaces: [A] },
          { effect: 'deny', permissions: ['*'], notSpaces: [A, B] },
          { effect: 'deny', permissions: ['task.view'], notSpaces: [B, C] },
        ],
      },
    ]).spaceRules;
    expect(spaceVisibility(rules, 'task.view')).toEqual({ deny: [A], only: [B] });
    expect(spaceVisibility(rules, 'doc.view')).toEqual({ deny: [], only: [A, B] });
    expect(spaceVisibility([], 'task.view')).toEqual({ deny: [], only: null });
  });

  it('only accepts a result at least as limited as the actor', () => {
    const actor = evaluatePolicies([{ statements: [contributor, { effect: 'deny', permissions: ['task.view'], spaces: [A] }] }]);
    const open = evaluatePolicies([{ statements: [contributor] }]);
    const same = evaluatePolicies([{ statements: [contributor, { effect: 'deny', permissions: ['*'], spaces: [A, B] }] }]);
    const withoutView = evaluatePolicies([{ statements: [{ effect: 'allow', permissions: ['doc.view'] }] }]);
    expect(keepsSpaceRules(actor, open)).toBe(false);
    expect(keepsSpaceRules(actor, same)).toBe(true);
    expect(keepsSpaceRules(actor, withoutView)).toBe(true);

    const onlyB = evaluatePolicies([{ statements: [contributor, { effect: 'deny', permissions: ['task.view'], notSpaces: [B] }] }]);
    const onlyBC = evaluatePolicies([{ statements: [contributor, { effect: 'deny', permissions: ['task.view'], notSpaces: [B, C] }] }]);
    expect(keepsSpaceRules(onlyB, onlyB)).toBe(true);
    expect(keepsSpaceRules(onlyB, onlyBC)).toBe(false);
    expect(keepsSpaceRules(onlyBC, onlyB)).toBe(true);
  });

  it('normalizes and validates space lists', () => {
    expect(PolicyDocumentPolicy.normalize({ statements: [{ effect: 'deny', permissions: ['task.*'], spaces: [A, A] }] })).toEqual({
      statements: [{ effect: 'deny', permissions: ['task.*'], spaces: [A] }],
    });
    expect(() => PolicyDocumentPolicy.normalize({ statements: [{ effect: 'deny', permissions: ['task.*'], spaces: ['not-an-id'] }] })).toThrow(/space ids/);
    expect(() => PolicyDocumentPolicy.normalize({ statements: [{ effect: 'allow', permissions: ['task.view'], notSpaces: [A] }] })).toThrow(/only deny/);
  });
});
