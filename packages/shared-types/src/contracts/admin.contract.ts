import type { PlatformRole } from '../domain/permissions.js';
import type { PageQuery } from '../domain/pagination.js';

export interface AdminUserResponse {
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole;
  suspended: boolean;
  workspaceCount: number;
  createdAt: string;
}

export interface AdminUserQuery extends PageQuery {
  /** Matches name or email. */
  search?: string;
}

/** Super admins change these; they can't change their own account. */
export interface UpdateAdminUserRequest {
  suspended?: boolean;
  platformRole?: PlatformRole;
}

export interface AdminWorkspaceResponse {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  memberCount: number;
  createdAt: string;
}

export interface AdminWorkspaceQuery extends PageQuery {
  search?: string;
}

export interface AuditLogEntryResponse {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  workspaceId: string | null;
  /** Only shown to platform admins. */
  ip: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogQuery extends PageQuery {
  /** Prefix match, e.g. "hr." or "member.". */
  action?: string;
  actorId?: string;
  /** Platform admins only; workspace views are always scoped to their workspace. */
  workspaceId?: string;
}
