import type { AccessGrantResponse, AccessRequestResponse, AccessRequestStatus } from '@taskflow/shared-types';

export interface AccessRequestRecord extends AccessRequestResponse {
  workspaceId: string;
}

/** Access requests and the time-limited grants that approve them (E3). Workspace scope. */
export abstract class AccessGrantRepository {
  abstract createRequest(input: { workspaceId: string; requesterId: string; permission: string; spaceId: string | null; note: string }): Promise<string>;
  abstract findRequest(workspaceId: string, id: string): Promise<AccessRequestRecord | null>;
  abstract listRequests(workspaceId: string, status: AccessRequestStatus, limit: number): Promise<AccessRequestResponse[]>;
  /** Marks a pending request decided; false when someone else got there first. */
  abstract decideRequest(workspaceId: string, id: string, status: Exclude<AccessRequestStatus, 'pending'>, decidedBy: string): Promise<boolean>;
  abstract createGrant(input: { workspaceId: string; userId: string; permission: string; spaceId: string | null; expiresAt: Date; grantedBy: string; requestId: string | null }): Promise<string>;
  abstract listActiveGrants(workspaceId: string, now: Date, limit: number): Promise<AccessGrantResponse[]>;
  abstract findGrant(workspaceId: string, id: string): Promise<AccessGrantResponse | null>;
  abstract deleteGrant(workspaceId: string, id: string): Promise<boolean>;
}
