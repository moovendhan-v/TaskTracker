import type { GithubInboxPullRequestResponse, GithubSyncEventResponse, GithubSyncOutcome } from '@taskflow/shared-types';
import type { GithubConnection, NewGithubConnection, PullRequestLink, PullRequestLinkInput } from './github.js';

export abstract class GithubRepository {
  abstract list(workspaceId: string): Promise<GithubConnection[]>;
  abstract findInWorkspace(workspaceId: string, connectionId: string): Promise<GithubConnection | null>;
  /** Platform scope only: the webhook knows the connection id before it knows the workspace. */
  abstract findWorkspaceOf(connectionId: string): Promise<string | null>;
  abstract create(connection: NewGithubConnection): Promise<GithubConnection>;
  abstract save(connection: GithubConnection): Promise<GithubConnection>;
  abstract delete(workspaceId: string, connectionId: string): Promise<void>;
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
}
