import type { PolicyDocument } from '../domain/iam.js';
import type { Permission } from '../domain/permissions.js';

/** A policy attached to a role: a managed one (by key) or one of the workspace's own. */
export interface AttachedPolicyResponse {
  /** `managed:<key>` or the custom policy's id. */
  ref: string;
  name: string;
  managed: boolean;
}

export interface RoleResponse {
  id: string;
  name: string;
  /** Set for built-in roles (owner, admin, member, guest); null for custom roles. */
  systemKey: string | null;
  /** Permissions granted directly on the role (its simplest inline policy). */
  permissions: Permission[];
  /** Extra statements that belong to this role only, including denies and field rules. */
  inlinePolicy: PolicyDocument;
  policies: AttachedPolicyResponse[];
  /** What members with this role can actually do, after every policy and deny. */
  effectivePermissions: Permission[];
  /** Protected fields members with this role can read. */
  readableFields: string[];
}

export interface CreateRoleRequest {
  name: string;
  permissions: Permission[];
}

export type UpdateRoleRequest = Partial<CreateRoleRequest>;
