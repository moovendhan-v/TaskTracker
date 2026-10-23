import type { Permission } from '../domain/permissions.js';

export interface RoleResponse {
  id: string;
  name: string;
  /** Set for built-in roles (owner, admin, member, guest); null for custom roles. */
  systemKey: string | null;
  permissions: Permission[];
}

export interface CreateRoleRequest {
  name: string;
  permissions: Permission[];
}

export type UpdateRoleRequest = Partial<CreateRoleRequest>;
