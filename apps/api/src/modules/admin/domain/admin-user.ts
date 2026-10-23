import type { PlatformRole } from '@taskflow/shared-types';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole;
  suspended: boolean;
  workspaceCount: number;
  createdAt: Date;
}

export interface AdminWorkspace {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  memberCount: number;
  createdAt: Date;
}
