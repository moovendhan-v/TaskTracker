import type { NormalizedQuery } from '../../../core/query/normalize-query.js';
import type { MemberDetails, MembershipWithRole, NewWorkspaceMember } from './workspace-member.js';

export abstract class WorkspaceMemberRepository {
  abstract findMembership(workspaceId: string, userId: string): Promise<MembershipWithRole | null>;
  abstract listMembershipsForUser(userId: string): Promise<MembershipWithRole[]>;
  abstract listDetails(workspaceId: string): Promise<MemberDetails[]>;
  abstract searchDetails(workspaceId: string, query: NormalizedQuery): Promise<{ items: MemberDetails[]; total: number }>;
  abstract findDetails(workspaceId: string, userId: string): Promise<MemberDetails | null>;
  abstract isMember(workspaceId: string, userId: string): Promise<boolean>;
  /** Every member's user id and role id, e.g. for finding who holds a permission. */
  abstract listMembersWithRoles(workspaceId: string): Promise<{ userId: string; roleId: string }[]>;
  /** Returns false when the user is already a member. */
  abstract addIfAbsent(member: NewWorkspaceMember): Promise<boolean>;
  abstract updateRole(workspaceId: string, userId: string, roleId: string): Promise<void>;
  abstract remove(workspaceId: string, userId: string): Promise<void>;
  /** Counts members holding a role and locks those rows until the transaction ends. */
  abstract countWithRoleForUpdate(workspaceId: string, roleId: string): Promise<number>;
}
