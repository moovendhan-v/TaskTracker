import type { ChatRetentionDays } from '@taskflow/shared-types';

/** A thread whose last message is past the workspace's retention, with the stored files to remove after it. */
export interface ExpiredThread {
  rootId: string;
  storageKeys: string[];
}

export abstract class ChatRetentionRepository {
  abstract getDays(workspaceId: string): Promise<ChatRetentionDays | null>;
  abstract setDays(workspaceId: string, days: ChatRetentionDays | null): Promise<void>;
  /** Platform scope: workspaces that keep chat for a limited time. */
  abstract workspacesWithRetention(limit: number): Promise<{ workspaceId: string; days: ChatRetentionDays }[]>;
  /** Platform scope: threads (a root and its replies) with nothing newer than `before`. */
  abstract expiredThreads(workspaceId: string, before: Date, limit: number): Promise<ExpiredThread[]>;
  /** Platform scope: deletes the roots; replies, reactions and attachment rows go with them. */
  abstract deleteThreads(workspaceId: string, rootIds: readonly string[]): Promise<number>;
}
