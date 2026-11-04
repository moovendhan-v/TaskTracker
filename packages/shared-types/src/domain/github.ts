import type { StatusCategory } from './task.js';

/** Letters and digits, starting with a letter: TF, WEB, OPS2. Pull requests mention tasks as <PREFIX>-<number>. */
export const TASK_PREFIX_PATTERN = '^[A-Z][A-Z0-9]{0,9}$';
export const DEFAULT_TASK_PREFIX = 'TF';
export const REPO_PATTERN = '^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$';

export const PULL_REQUEST_STATES = ['open', 'merged', 'closed'] as const;
export type PullRequestState = (typeof PULL_REQUEST_STATES)[number];

/** What a connection does to linked tasks, beyond automations: move them to the first status with this meaning. */
export interface GithubSyncSettings {
  onOpened: StatusCategory | null;
  onMerged: StatusCategory | null;
  /** Closed without merging. Off by default: closing a PR often just means another one replaces it. */
  onClosed?: StatusCategory | null;
}

export const DEFAULT_GITHUB_SYNC: GithubSyncSettings = { onOpened: 'review', onMerged: 'done', onClosed: null };

/** How a delivery went, for the sync log. */
export const GITHUB_SYNC_OUTCOMES = ['ok', 'ignored', 'error'] as const;
export type GithubSyncOutcome = (typeof GITHUB_SYNC_OUTCOMES)[number];

/** Sync log entries kept per connection; older ones are dropped. */
export const GITHUB_SYNC_LOG_KEPT = 200;

export interface GithubSyncEventResponse {
  id: string;
  connectionId: string;
  event: string;
  outcome: GithubSyncOutcome;
  /** Our own short text, never payload content beyond a PR number. */
  detail: string;
  prNumber: number | null;
  /** Task numbers the delivery linked. */
  taskNumbers: number[];
  createdAt: string;
}

/** A pull request that mentions no task (or none the connection's owner can see), waiting to be linked or dismissed. */
export interface GithubInboxPullRequestResponse {
  id: string;
  connectionId: string;
  repo: string;
  number: number;
  title: string;
  /** Always https://github.com/… (checked when the webhook arrives). */
  url: string;
  author: string;
  branch: string;
  state: PullRequestState;
  updatedAt: string;
}

/** Task numbers a pull request mentions, e.g. "TF-42 fix login" or branch "tf-42-login". */
export function taskReferences(prefix: string, ...texts: readonly (string | null | undefined)[]): number[] {
  const pattern = new RegExp(`(?:^|[^A-Za-z0-9])${prefix}-(\\d{1,9})(?![A-Za-z0-9])`, 'gi');
  const numbers = new Set<number>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.slice(0, 100_000).matchAll(pattern)) {
      numbers.add(Number(match[1]));
      if (numbers.size >= 20) return [...numbers];
    }
  }
  return [...numbers];
}
