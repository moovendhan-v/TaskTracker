import type { ActiveCallResponse } from '@taskflow/shared-types';

export interface CallSessionRecord {
  id: string;
  workspaceId: string;
  channelId: string;
  room: string;
  startedBy: string;
  startedAt: Date;
  endedAt: Date | null;
  messageId: string | null;
}

/** Calls (D2). Every method runs in the caller's row-level security scope. */
export abstract class CallRepository {
  abstract activeInChannel(workspaceId: string, channelId: string): Promise<CallSessionRecord | null>;
  /** Starts a call unless one is already going in the channel; returns the one that is. */
  abstract start(input: { id: string; workspaceId: string; channelId: string; room: string; startedBy: string }): Promise<{ session: CallSessionRecord; created: boolean }>;
  abstract setMessage(workspaceId: string, sessionId: string, messageId: string): Promise<void>;
  /** Calls going on now in channels the caller can read, with who's in them. */
  abstract activeCalls(workspaceId: string): Promise<ActiveCallResponse[]>;
  // From here on: LiveKit webhooks and the sweep.
  abstract findByRoom(room: string): Promise<CallSessionRecord | null>;
  /** False when this webhook event was handled already. */
  abstract firstDelivery(eventId: string): Promise<boolean>;
  abstract joined(session: CallSessionRecord, userId: string): Promise<void>;
  abstract left(session: CallSessionRecord, userId: string): Promise<void>;
  /** Ends the call; how long it lasted and how many people took part. */
  abstract end(session: CallSessionRecord): Promise<{ minutes: number; people: number } | null>;
  /** Calls nobody has been in for a while (LiveKit never said they ended). */
  abstract abandoned(idleSince: Date, limit: number): Promise<CallSessionRecord[]>;
  /** People in calls of private channels and DMs they're no longer members of. */
  abstract outsiders(limit: number): Promise<{ room: string; userId: string }[]>;
}
