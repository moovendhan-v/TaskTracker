import type { Request } from 'express';
import type { Permission, PlatformRole } from '@taskflow/shared-types';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  platformRole: PlatformRole;
}

export interface WorkspaceAccess {
  workspaceId: string;
  roleId: string | null;
  permissions: ReadonlySet<Permission>;
  /** True when a super admin is acting in a workspace they are not a member of. */
  viaPlatformRole: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: SessionUser;
  workspaceAccess?: WorkspaceAccess;
}

/** Who did something and from where, passed from controllers into services for auditing. */
export interface Actor {
  userId: string;
  platformRole: PlatformRole;
  ip: string | null;
}
