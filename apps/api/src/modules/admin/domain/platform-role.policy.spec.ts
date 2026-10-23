import { describe, expect, it } from 'vitest';
import { PlatformRolePolicy } from './platform-role.policy.js';

const admin = { id: 'a2', platformRole: 'SUPER_ADMIN' as const, suspended: false };
const user = { id: 'u1', platformRole: 'USER' as const, suspended: false };

describe('PlatformRolePolicy', () => {
  it('blocks changing your own access', () => {
    expect(() => PlatformRolePolicy.assertAllowed({ actorId: 'u1', target: user, next: { suspended: true }, activeSuperAdmins: 2 })).toThrow(
      /your own/,
    );
  });

  it('keeps at least one active super admin', () => {
    expect(() => PlatformRolePolicy.assertAllowed({ actorId: 'a1', target: admin, next: { platformRole: 'USER' }, activeSuperAdmins: 1 })).toThrow(
      /at least one/,
    );
    expect(() => PlatformRolePolicy.assertAllowed({ actorId: 'a1', target: admin, next: { suspended: true }, activeSuperAdmins: 2 })).not.toThrow();
  });

  it('allows suspending and promoting ordinary users', () => {
    expect(() => PlatformRolePolicy.assertAllowed({ actorId: 'a1', target: user, next: { suspended: true }, activeSuperAdmins: 1 })).not.toThrow();
    expect(() => PlatformRolePolicy.assertAllowed({ actorId: 'a1', target: user, next: { platformRole: 'SUPER_ADMIN' }, activeSuperAdmins: 1 })).not.toThrow();
  });
});
