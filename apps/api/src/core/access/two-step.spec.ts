import { ADMIN_PERMISSIONS, PERMISSIONS, permissionsWithoutTwoStep } from '@taskflow/shared-types';
import { describe, expect, it } from 'vitest';

describe('permissionsWithoutTwoStep', () => {
  it('keeps everything when not required', () => {
    expect(permissionsWithoutTwoStep('off', PERMISSIONS)).toEqual([...PERMISSIONS]);
  });

  it('holds back only admin rights when required of admins', () => {
    const kept = permissionsWithoutTwoStep('admins', PERMISSIONS);
    for (const permission of ADMIN_PERMISSIONS) expect(kept).not.toContain(permission);
    expect(kept).toContain('task.create');
    expect(kept).toHaveLength(PERMISSIONS.length - ADMIN_PERMISSIONS.length);
    expect(permissionsWithoutTwoStep('admins', ['task.view', 'task.create'])).toEqual(['task.view', 'task.create']);
  });

  it('holds back everything when required of everyone', () => {
    expect(permissionsWithoutTwoStep('everyone', PERMISSIONS)).toEqual([]);
  });

  it('treats every role-changing or audit permission as an admin right', () => {
    expect(ADMIN_PERMISSIONS).toEqual(expect.arrayContaining(['workspace.manage', 'members.manage', 'roles.manage', 'integration.manage', 'audit.view']));
  });
});
