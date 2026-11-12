import type { GithubInboxPullRequestResponse, GithubSyncConflictResponse, GithubSyncEventResponse, GithubSyncOutcome, PullRequestState } from '@taskflow/shared-types';
import type { GithubConnection, NewGithubConnection, PullRequestLink, PullRequestLinkInput } from './github.js';

export abstract class GithubRepository {
  abstract list(workspaceId: string): Promise<GithubConnection[]>;
  abstract findInWorkspace(workspaceId: string, connectionId: string): Promise<GithubConnection | null>;
  /** Platform scope only: the webhook knows the connection id before it knows the workspace. */
  abstract findWorkspaceOf(connectionId: string): Promise<string | null>;
  abstract create(connection: NewGithubConnection): Promise<GithubConnection>;
  abstract save(connection: GithubConnection): Promise<GithubConnection>;
  abstract delete(workspaceId: string, connectionId: string): Promise<void>;
  /** Records the latest delivery or poll on the connection, touching only those two columns. */
  abstract noteDelivery(workspaceId: string, connectionId: string, at: Date, status: string): Promise<void>;
  /** False when this delivery was handled before. */
  abstract claimDelivery(workspaceId: string, connectionId: string, deliveryId: string): Promise<boolean>;
  abstract upsertLink(link: PullRequestLinkInput): Promise<void>;
  abstract listLinksForTask(workspaceId: string, taskId: string): Promise<PullRequestLink[]>;

  // ── Sync log and inbox (E2) ──
  /** Adds a log entry and keeps the newest GITHUB_SYNC_LOG_KEPT per connection. */
  abstract logEvent(entry: { workspaceId: string; connectionId: string; event: string; outcome: GithubSyncOutcome; detail: string; prNumber: number | null; taskNumbers: number[] }): Promise<void>;
  abstract listEvents(workspaceId: string, connectionId: string, limit: number): Promise<GithubSyncEventResponse[]>;
  abstract upsertInbox(entry: Omit<GithubInboxPullRequestResponse, 'id' | 'updatedAt'> & { workspaceId: string }): Promise<void>;
  abstract removeFromInbox(workspaceId: string, connectionId: string, number: number): Promise<void>;
  abstract listInbox(workspaceId: string, limit: number): Promise<GithubInboxPullRequestResponse[]>;
  abstract findInboxItem(workspaceId: string, id: string): Promise<GithubInboxPullRequestResponse | null>;
  abstract deleteInboxItem(workspaceId: string, id: string): Promise<boolean>;

  /** The status sync last left a task in for this pull request; null before the first sync. */
  abstract syncedStatus(workspaceId: string, connectionId: string, taskId: string, prNumber: number): Promise<string | null>;
  abstract setSyncedStatus(workspaceId: string, connectionId: string, taskId: string, prNumber: number, statusId: string): Promise<void>;
  /** One open conflict per task and pull request: a newer event replaces the older one. */
  abstract upsertConflict(conflict: { workspaceId: string; connectionId: string; taskId: string; prNumber: number; prTitle: string; prUrl: string; event: PullRequestState; wantedStatusId: string }): Promise<void>;
  abstract listConflictsForTask(workspaceId: string, taskId: string): Promise<GithubSyncConflictResponse[]>;
  abstract findConflict(workspaceId: string, id: string): Promise<(GithubSyncConflictResponse & { connectionId: string }) | null>;
  abstract deleteConflict(workspaceId: string, id: string): Promise<boolean>;
}
