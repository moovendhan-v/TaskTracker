export interface MemberResponse {
  userId: string;
  name: string;
  email: string;
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
