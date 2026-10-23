import { describe, expect, it } from 'vitest';
import type { Permission } from '@taskflow/shared-types';
import { DomainError } from '../../../core/domain/domain-error.js';
import { RoleGrantPolicy } from './role-grant.policy.js';

const held = new Set<Permission>(['task.view', 'task.update', 'roles.manage']);

describe('RoleGrantPolicy', () => {
  it('allows defining a role with a subset of held permissions', () => {
    expect(() => RoleGrantPolicy.assertCanDefine(held, ['task.view'])).not.toThrow();
  });

  it('rejects permissions the caller does not hold', () => {
    expect(() => RoleGrantPolicy.assertCanDefine(held, ['task.delete'])).toThrow(DomainError);
  });

  it('reserves workspace.manage for the Owner role', () => {
    const owner = new Set<Permission>(['workspace.manage']);
    expect(() => RoleGrantPolicy.assertCanDefine(owner, ['workspace.manage'])).toThrow(/reserved/);
  });

  it('blocks handing out a role stronger than the caller', () => {
    expect(() => RoleGrantPolicy.assertCanHandOut(held, ['task.view', 'members.manage'])).toThrow(DomainError);
  });
});
