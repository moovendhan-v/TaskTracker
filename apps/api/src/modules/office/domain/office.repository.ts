import type { OfficeChosenStatus } from '@taskflow/shared-types';

export interface OfficePresenceRecord {
  userId: string;
  name: string;
  x: number;
  y: number;
  chosen: OfficeChosenStatus;
  lastSeenAt: Date;
  /** In a huddle the reader can see (row-level security hides calls in channels they can't read). */
  inCall: boolean;
}

/** The virtual office (D3). Runs in the caller's workspace scope. */
export abstract class OfficeRepository {
  abstract list(workspaceId: string): Promise<OfficePresenceRecord[]>;
  abstract find(workspaceId: string, userId: string): Promise<OfficePresenceRecord | null>;
  /** Someone other than `exceptUserId` who was seen recently stands here. */
  abstract occupied(workspaceId: string, x: number, y: number, exceptUserId: string, seenSince: Date): Promise<boolean>;
  abstract save(workspaceId: string, userId: string, state: { x: number; y: number; chosen: OfficeChosenStatus; lastSeenAt: Date }): Promise<void>;
}
