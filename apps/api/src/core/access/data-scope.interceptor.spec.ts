import { describe, expect, it } from 'vitest';
import type { SessionUser, WorkspaceAccess } from '../http/types/authenticated-request.js';
import { resolveDataScope } from './data-scope.interceptor.js';

const user: SessionUser = { id: 'user-1', email: 'a@example.com', name: 'A', image: null, platformRole: 'USER', emailVerified: true };
const admin: SessionUser = { ...user, id: 'admin-1', platformRole: 'SUPER_ADMIN' };
const access: WorkspaceAccess = { workspaceId: 'ws-1', roleId: 'role-1', permissions: new Set(), viaPlatformRole: false };

describe('resolveDataScope', () => {
  it('limits workspace operations to that workspace', () => {
    expect(resolveDataScope({ user, workspaceAccess: access }, false)).toEqual({ kind: 'workspace', workspaceId: 'ws-1', userId: 'user-1' });
  });

  it('keeps a super admin acting in a workspace inside that workspace', () => {
    expect(resolveDataScope({ user: admin, workspaceAccess: { ...access, viaPlatformRole: true } }, true)).toMatchObject({
      kind: 'workspace',
    });
  });

  it('gives signed-in users their own rows outside a workspace', () => {
    expect(resolveDataScope({ user }, false)).toEqual({ kind: 'user', userId: 'user-1' });
  });

  it('only gives platform scope to super admins on platform admin operations', () => {
    expect(resolveDataScope({ user: admin }, true)).toEqual({ kind: 'platform' });
    expect(resolveDataScope({ user: admin }, false)).toEqual({ kind: 'user', userId: 'admin-1' });
    expect(resolveDataScope({ user }, true)).toEqual({ kind: 'user', userId: 'user-1' });
  });

  it('gives no scope without a session', () => {
    expect(resolveDataScope({} as never, false)).toBeNull();
  });
});
