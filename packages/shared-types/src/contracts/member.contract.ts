export interface MemberResponse {
  userId: string;
  name: string;
  /** Null unless a policy lets the caller read `member.email`. */
  email: string | null;
  roleId: string;
  roleName: string;
  joinedAt: string;
}

export interface AddMemberRequest {
  email: string;
  roleId: string;
}

export interface UpdateMemberRoleRequest {
  roleId: string;
}
