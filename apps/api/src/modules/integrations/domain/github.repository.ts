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
}
