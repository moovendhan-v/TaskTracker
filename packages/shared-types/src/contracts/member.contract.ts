import type { WorkspaceRole } from '../domain/workspace.js';

export interface MemberResponse {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
}
