import { describe, expect, it } from 'vitest';
import { canReadField, evaluatePolicies, MANAGED_POLICIES, type Permission } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import { effectiveAccessForRole, PolicyRef } from './policy.js';
import { PolicyDocumentPolicy } from './policy-document.policy.js';

const role = (permissions: Permission[] = []) => ({ permissions, inlinePolicy: { statements: [] } });

describe('policy evaluation', () => {
  it('expands wildcards and lets deny win', () => {
    const access = evaluatePolicies([
      { statements: [{ effect: 'allow', permissions: ['task.*', 'doc.view'], fields: ['member.*'] }] },
      { statements: [{ effect: 'deny', permissions: ['task.delete'], fields: ['member.email'] }] },
    ]);
    expect(access.permissions).toEqual(['task.view', 'task.create', 'task.update', 'task.assign', 'doc.view']);
    expect(canReadField(access, 'member.email')).toBe(false);
  });

  it('keeps hidden-by-default fields hidden until allowed, and visible-by-default fields visible until denied', () => {
    const none = evaluatePolicies([]);
    expect(canReadField(none, 'member.email')).toBe(false);
    expect(canReadField(none, 'task.metadata')).toBe(true);
    expect(canReadField(evaluatePolicies([{ statements: [{ effect: 'deny', fields: ['task.*'] }] }]), 'task.metadata')).toBe(false);
  });

  it('combines direct permissions, inline statements and attached policies', () => {
    const access = effectiveAccessForRole(
      { permissions: ['task.view'], inlinePolicy: { statements: [{ effect: 'deny', permissions: ['doc.view'] }] } },
      [
        { roleId: 'r', managedKey: 'ReadOnly', policyId: null },
        { roleId: 'r', managedKey: null, policyId: 'p1' },
        { roleId: 'r', managedKey: null, policyId: 'gone' },
      ],
      new Map([['p1', { document: { statements: [{ effect: 'allow' as const, permissions: ['audit.view'] }] } }]]),
    );
    expect(access.permissions).toEqual(['task.view', 'audit.view']);
  });

  it('gives built-in roles the same rights they had before policies', () => {
    const owner = effectiveAccessForRole(role(), [{ roleId: 'r', managedKey: 'FullAccess', policyId: null }], new Map());
    const admin = effectiveAccessForRole(role(), [{ roleId: 'r', managedKey: 'WorkspaceAdmin', policyId: null }], new Map());
    expect(owner.permissions).toContain('workspace.manage');
    expect(admin.permissions).not.toContain('workspace.manage');
    expect(admin.permissions).toHaveLength(owner.permissions.length - 1);
  });

  it('refers to policies by managed key or id', () => {
    expect(PolicyRef.parse('managed:Auditor')).toEqual({ managedKey: 'Auditor' });
    expect(PolicyRef.of({ managedKey: null, policyId: 'abc' })).toBe('abc');
    expect(MANAGED_POLICIES.every((policy) => PolicyDocumentPolicy.normalize(policy.document))).toBe(true);
  });
});

describe('PolicyDocumentPolicy.assertCanGrant', () => {
  const actor = { permissions: new Set<Permission>(['task.view', 'task.update']), readableFields: new Set(['task.metadata']) };
  const grant = (statements: object[]) => () => PolicyDocumentPolicy.assertCanGrant(actor, { statements } as never);

  it('allows granting what the actor has, and any deny', () => {
    expect(grant([{ effect: 'allow', permissions: ['task.view'], fields: ['task.metadata'] }])).not.toThrow();
    expect(grant([{ effect: 'deny', permissions: ['*'], fields: ['*'] }])).not.toThrow();
  });

  it('refuses more than the actor has, through wildcards too', () => {
    expect(grant([{ effect: 'allow', permissions: ['task.*'] }])).toThrow(DomainError);
    expect(grant([{ effect: 'allow', fields: ['member.email'] }])).toThrow(/fields you cannot see/);
    expect(grant([{ effect: 'allow', permissions: ['*'] }])).toThrow(/reserved for the Owner/);
  });
});
