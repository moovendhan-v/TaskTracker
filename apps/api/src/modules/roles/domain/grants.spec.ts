import { canInSpace } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';
import { effectiveAccessWithGrants } from './policy.js';

const P = 'aaaaaaaa-0000-4000-8000-000000000001';
const Q = 'aaaaaaaa-0000-4000-8000-000000000002';
const member = [{ statements: [{ effect: 'allow' as const, permissions: ['task.view', 'task.create'] }] }];

describe('time-limited grants on top of a role', () => {
  it('adds a workspace-wide grant as an allow', () => {
    const access = effectiveAccessWithGrants(member, [{ permission: 'task.delete', spaceId: null }]);
    expect(access.permissions).toEqual(expect.arrayContaining(['task.view', 'task.delete']));
  });

  it('never beats a deny in the role', () => {
    const denied = [...member, { statements: [{ effect: 'deny' as const, permissions: ['task.delete'] }] }];
    expect(effectiveAccessWithGrants(denied, [{ permission: 'task.delete', spaceId: null }]).permissions).not.toContain('task.delete');
    expect(effectiveAccessWithGrants(denied, [{ permission: 'task.delete', spaceId: P }]).permissions).not.toContain('task.delete');
  });

  it('gives a one-project grant only in that project', () => {
    const access = effectiveAccessWithGrants(member, [{ permission: 'task.delete', spaceId: P }]);
    expect(canInSpace(access, P, 'task.delete')).toBe(true);
    expect(canInSpace(access, Q, 'task.delete')).toBe(false);
    // Two projects: both, and still nowhere else.
    const two = effectiveAccessWithGrants(member, [{ permission: 'task.delete', spaceId: P }, { permission: 'task.delete', spaceId: Q }]);
    expect([canInSpace(two, P, 'task.delete'), canInSpace(two, Q, 'task.delete'), canInSpace(two, 'aaaaaaaa-0000-4000-8000-000000000003', 'task.delete')]).toEqual([true, true, false]);
  });

  it("keeps the role's own project denies, and changes nothing the role already allows", () => {
    const deniedInP = [{ statements: [{ effect: 'allow' as const, permissions: ['task.update'] }, { effect: 'deny' as const, permissions: ['task.update'], spaces: [P] }] }];
    const access = effectiveAccessWithGrants(deniedInP, [{ permission: 'task.update', spaceId: P }]);
    expect(canInSpace(access, P, 'task.update')).toBe(false);
    expect(canInSpace(access, Q, 'task.update')).toBe(true);
  });

  it('only honours workspace-wide grants of permissions that don’t apply in a project', () => {
    expect(effectiveAccessWithGrants(member, [{ permission: 'roles.manage', spaceId: P }]).permissions).not.toContain('roles.manage');
  });
});
