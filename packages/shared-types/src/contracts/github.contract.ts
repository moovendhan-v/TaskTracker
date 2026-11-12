import type { GithubSyncSettings, PullRequestState } from '../domain/github.js';

export interface GithubConnectionResponse {
  id: string;
  repo: string;
  taskPrefix: string;
  sync: GithubSyncSettings;
  /** Where GitHub sends events, relative to the site: prefix it with the site's origin. */
  webhookPath: string;
  createdById: string | null;
  lastDeliveryAt: string | null;
  /** e.g. "ok", "ignored: issues", "bad signature" */
  lastDeliveryStatus: string | null;
  /** Connected through the TaskFlow GitHub App (no webhook of its own; changes are polled or arrive through the app). */
  viaApp: boolean;
  createdAt: string;
}

/** Whether this server has the TaskFlow GitHub App, and whether people can install it from TaskFlow. */
export interface GithubAppInfoResponse {
  enabled: boolean;
  canInstall: boolean;
  slug: string | null;
}

/** A GitHub App installation the workspace may use (an account or organization on GitHub). */
export interface GithubInstallationResponse {
  id: string;
  accountLogin: string;
  accountType: 'User' | 'Organization';
  createdAt: string;
}

/** A task's GitHub issue: title and open / closed follow each other both ways. */
export interface GithubIssueLinkResponse {
  id: string;
  connectionId: string;
  repo: string;
  number: number;
  url: string;
  closed: boolean;
  /** A change in TaskFlow is on its way to GitHub. */
  pending: boolean;
  /** Why the last change couldn't reach GitHub, if it couldn't. */
  lastError: string | null;
}

/** Returned once, when a connection is made or its secret replaced; it can't be read again. */
export interface GithubSecretResponse {
  connection: GithubConnectionResponse;
  webhookSecret: string;
}

export interface SaveGithubConnectionRequest {
  repo: string;
  taskPrefix?: string;
  sync?: Partial<GithubSyncSettings>;
}

export interface PullRequestLinkResponse {
  id: string;
  taskId: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  state: PullRequestState;
  author: string;
  branch: string;
  updatedAt: string;
}
