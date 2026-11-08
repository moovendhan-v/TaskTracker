/**
 * E3: asking for access and approving it in one click. An approval is a grant of one
 * permission (in one project, or the whole workspace) that always ends: the "time
 * condition". Grants only add allows; a deny in the person's role still wins.
 */
export const ACCESS_GRANT_DAYS = [1, 7, 30] as const;
export type AccessGrantDays = (typeof ACCESS_GRANT_DAYS)[number];

export const ACCESS_REQUEST_STATUSES = ['pending', 'approved', 'declined'] as const;
export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

export interface AccessRequestResponse {
  id: string;
  requesterId: string;
  requesterName: string;
  permission: string;
  spaceId: string | null;
  spaceName: string | null;
  note: string;
  status: AccessRequestStatus;
  createdAt: string;
}

export interface AccessGrantResponse {
  id: string;
  userId: string;
  userName: string;
  permission: string;
  spaceId: string | null;
  spaceName: string | null;
  expiresAt: string;
  grantedByName: string | null;
  createdAt: string;
}

export function isAccessGrantDays(value: unknown): value is AccessGrantDays {
  return (ACCESS_GRANT_DAYS as readonly unknown[]).includes(value);
}
