import type {
  OrganizationActivityResponse,
  OrganizationMemberResponse,
  OrganizationWorkspaceResponse,
  OrgRole,
  TwoStepRequirement,
} from '@taskflow/shared-types';

export interface OrganizationRecord {
  id: string;
  name: string;
  twoStepRequired: TwoStepRequirement;
  createdAt: Date;
}

/**
 * Organizations (A3). Every method runs in the caller's current row-level security scope:
 * the user scope for your own memberships, the organization scope for everything else.
 */
export abstract class OrganizationRepository {
  /** Your own memberships (readable in any scope that carries your user id). */
  abstract myRole(organizationId: string, userId: string): Promise<OrgRole | null>;
  abstract listMine(userId: string): Promise<(OrganizationRecord & { role: OrgRole })[]>;
  abstract create(organization: { id: string; name: string; createdBy: string }): Promise<void>;
  abstract find(organizationId: string): Promise<OrganizationRecord | null>;
  abstract rename(organizationId: string, name: string): Promise<void>;
  abstract setTwoStep(organizationId: string, requirement: TwoStepRequirement): Promise<void>;
  abstract delete(organizationId: string): Promise<void>;
  abstract members(organizationId: string): Promise<OrganizationMemberResponse[]>;
  abstract addMember(organizationId: string, userId: string, role: OrgRole): Promise<boolean>;
  abstract setRole(organizationId: string, userId: string, role: OrgRole): Promise<void>;
  abstract removeMember(organizationId: string, userId: string): Promise<void>;
  abstract ownerCount(organizationId: string): Promise<number>;
  abstract workspaces(organizationId: string): Promise<OrganizationWorkspaceResponse[]>;
  abstract activity(organizationId: string, limit: number): Promise<OrganizationActivityResponse[]>;
  /** A signed-up user by email (Better Auth's table, outside row-level security). */
  abstract findUserByEmail(email: string): Promise<{ id: string; name: string; emailVerified: boolean } | null>;
  /** Workspace scope: the organization a workspace is in, if any. */
  abstract workspaceOrganization(workspaceId: string): Promise<{ id: string; name: string; twoStepRequired: TwoStepRequirement } | null>;
  /** Workspace scope: moves the workspace into an organization, or out (null). */
  abstract setWorkspaceOrganization(workspaceId: string, organizationId: string | null): Promise<void>;
}
