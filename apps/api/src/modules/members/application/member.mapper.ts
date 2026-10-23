import type { MemberResponse } from '@taskflow/shared-types';
import type { MemberDetails } from '../domain/workspace-member.js';

export const MemberMapper = {
  toResponse(member: MemberDetails): MemberResponse {
    return {
      userId: member.userId,
      name: member.name,
      email: member.email,
      roleId: member.roleId,
      roleName: member.roleName,
      joinedAt: member.joinedAt.toISOString(),
    };
  },
};
