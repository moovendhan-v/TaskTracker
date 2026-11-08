import type { Request } from 'express';
import type { Permission, PlatformRole, SpaceRule } from '@taskflow/shared-types';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  platformRole: PlatformRole;
  emailVerified: boolean;
}

export interface WorkspaceAccess {
  workspaceId: string;
  roleId: string | null;
  permissions: ReadonlySet<Permission>;
  /** Protected fields (e.g. `member.email`) this caller may read; others come back as null. */
  readableFields: ReadonlySet<string>;
  /** Spaces where some of `permissions` are taken away. Row-level security hides the spaces whose task.view is denied. */
  spaceRules: readonly SpaceRule[];
  /** True when a super admin is acting in a workspace they are not a member of. */
  viaPlatformRole: boolean;
  /** The workspace requires two-step sign-in and this member hasn't set it up: some permissions are held back. */
  twoStepMissing?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: SessionUser;
  workspaceAccess?: WorkspaceAccess;
}

/** Who did something and from where, passed from resolvers into services for auditing. */
export interface Actor {
  userId: string;
  platformRole: PlatformRole;
  ip: string | null;
}
