import type { GithubSyncSettings, PullRequestState } from '@taskflow/shared-types';

export interface GithubConnection {
  id: string;
  workspaceId: string;
  repo: string;
  taskPrefix: string;
  sync: GithubSyncSettings;
  /** The webhook secret, sealed with SecretBox. */
  secretSealed: string;
  /** Linked tasks are moved as this person, with their access at the time. */
  createdById: string | null;
  lastDeliveryAt: Date | null;
  lastDeliveryStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewGithubConnection = Pick<GithubConnection, 'workspaceId' | 'repo' | 'taskPrefix' | 'sync' | 'secretSealed' | 'createdById'>;

export interface PullRequestLink {
  id: string;
  workspaceId: string;
  connectionId: string;
  taskId: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  state: PullRequestState;
  author: string;
  branch: string;
  updatedAt: Date;
}

export type PullRequestLinkInput = Omit<PullRequestLink, 'id' | 'updatedAt'>;
