import type { PullRequestState } from '@taskflow/shared-types';
import type { AppConnectionRef, GithubInstallation, IssueLink, IssuePush } from './github-app.js';

export abstract class GithubAppRepository {
  abstract listInstallations(workspaceId: string): Promise<GithubInstallation[]>;
  abstract findInstallation(workspaceId: string, id: string): Promise<GithubInstallation | null>;
  abstract saveInstallation(installation: Omit<GithubInstallation, 'id' | 'createdAt'>): Promise<GithubInstallation>;
  abstract deleteInstallation(workspaceId: string, id: string): Promise<void>;

  /** Platform scope: workspaces with app connections to poll (not polled since `polledBefore`) or pushes due. */
  abstract workspacesToSync(now: Date, polledBefore: Date, limit: number): Promise<string[]>;
  /** App connections of a workspace not polled since `polledBefore`; each is claimed (polled_at = now) so one instance polls it. */
  abstract claimPolls(workspaceId: string, now: Date, polledBefore: Date, limit: number): Promise<AppConnectionRef[]>;
  abstract setCursors(workspaceId: string, connectionId: string, cursors: { pullsCursor?: Date; issuesCursor?: Date }): Promise<void>;
  /** The state TaskFlow last recorded for a pull request (linked or in the inbox); null when new. */
  abstract knownPullState(workspaceId: string, connectionId: string, number: number): Promise<PullRequestState | null>;

  abstract createIssueLink(link: { workspaceId: string; connectionId: string; taskId: string; number: number; url: string; syncedTitle: string; syncedClosed: boolean; createdById: string }): Promise<IssueLink>;
  abstract findIssueLink(workspaceId: string, connectionId: string, number: number): Promise<IssueLink | null>;
  abstract listIssueLinksForTask(workspaceId: string, taskId: string): Promise<(IssueLink & { repo: string })[]>;
  abstract setSynced(workspaceId: string, linkId: string, title: string, closed: boolean): Promise<void>;
  /** Marks the task's issue links whose title or open / closed state differs from what sync last set; returns how many. */
  abstract markPushDue(workspaceId: string, taskId: string): Promise<number>;
  /** Leases due pushes (one instance each), with the task as it is now. */
  abstract leasePushes(workspaceId: string, now: Date, leaseUntil: Date, limit: number): Promise<IssuePush[]>;
  /** A push went through: sync now agrees on these values. Still due if the task changed again meanwhile. */
  abstract pushed(workspaceId: string, linkId: string, version: number, title: string, closed: boolean): Promise<void>;
  /** A push failed: try again at `retryAt`, or give up (no longer due) with the error shown. */
  abstract pushFailed(workspaceId: string, linkId: string, error: string, retryAt: Date | null): Promise<void>;
}
