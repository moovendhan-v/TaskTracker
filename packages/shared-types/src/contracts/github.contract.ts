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
  createdAt: string;
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
